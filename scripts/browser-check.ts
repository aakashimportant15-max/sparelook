import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocalEnv } from "../src/db/load-env";

// Headless Chrome audit: 360px layout, horizontal overflow, Tab order, form errors.
// Requires the dev server to be running and DEMO_USER_PASSWORD in .env.

loadLocalEnv();

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const BASE = process.env.BROWSER_CHECK_BASE ?? "http://localhost:3000";
const EVIDENCE = path.resolve("docs/evidence");
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD;

type CdpEvent = { method: string; params?: Record<string, unknown> };
type CdpMessage = CdpEvent & {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message: string };
  sessionId?: string;
};

type Pending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

class Cdp {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  readonly events: CdpEvent[] = [];

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (typeof message.id === "number") {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result ?? {});
        return;
      }
      if (message.method)
        this.events.push({ method: message.method, params: message.params });
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error(`WebSocket failed: ${url}`)),
        {
          once: true,
        },
      );
    });
    return new Cdp(socket);
  }

  send(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

type OverflowReport = { sw: number; iw: number; offenders: string[] };
type A11yReport = {
  dupIds: string[];
  unlabeledControls: number;
  imagesWithoutAlt: number;
  emptyLinks: number;
};

const results: { check: string; status: "PASS" | "FAIL"; detail: string }[] = [];
const consoleErrors: string[] = [];

function record(check: string, ok: boolean, detail: string) {
  results.push({ check, status: ok ? "PASS" : "FAIL", detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${check} - ${detail}\n`);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main(): Promise<void> {
  if (!DEMO_PASSWORD) throw new Error("DEMO_USER_PASSWORD is not set (checked .env)");
  await waitForHttp(`${BASE}/api/health`, 20_000);
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sharespace-chrome-"));
  const chrome: ChildProcess = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let cdp: Cdp | undefined;
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/json/version`, 20_000);
    const version = (await (
      await fetch(`http://127.0.0.1:${PORT}/json/version`)
    ).json()) as {
      webSocketDebuggerUrl: string;
    };
    cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    const client = cdp;
    const target = await client.send("Target.createTarget", { url: "about:blank" });
    const targetId = target.targetId as string;
    const attached = await client.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const sid = attached.sessionId as string;

    await client.send("Page.enable", {}, sid);
    await client.send("Runtime.enable", {}, sid);
    await client.send("Log.enable", {}, sid);
    await client.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 360, height: 800, deviceScaleFactor: 2, mobile: true },
      sid,
    );

    const evaluate = async <T>(expression: string): Promise<T> => {
      const response = await client.send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sid,
      );
      if (response.exceptionDetails) {
        const details = response.exceptionDetails as { text?: string };
        throw new Error(`Page evaluation failed: ${details.text ?? "unknown"}`);
      }
      return (response.result as { value: T }).value;
    };

    const navigate = async (route: string): Promise<void> => {
      await client.send("Page.navigate", { url: `${BASE}${route}` }, sid);
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        try {
          const ready = await evaluate<string>("document.readyState");
          if (ready === "complete") {
            await delay(350);
            return;
          }
        } catch {
          // navigation in flight
        }
        await delay(150);
      }
      throw new Error(`Timed out loading ${route}`);
    };

    const screenshot = async (name: string): Promise<void> => {
      const shot = await client.send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false },
        sid,
      );
      fs.writeFileSync(
        path.join(EVIDENCE, name),
        Buffer.from(shot.data as string, "base64"),
      );
    };

    const signOut = async () => {
      await evaluate(`fetch("/api/auth/sign-out", { method: "POST" }).then(() => true)`);
    };

    const signIn = async (email: string): Promise<number> => {
      const status = await evaluate<number>(
        `fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: ${JSON.stringify(email)}, password: ${JSON.stringify(DEMO_PASSWORD)} }),
        }).then((r) => r.status)`,
      );
      return status;
    };

    const overflow = () =>
      evaluate<OverflowReport>(`(() => {
        const iw = window.innerWidth;
        const offenders = [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > iw + 1;
        }).slice(0, 5).map((el) => {
          const cls = typeof el.className === "string" ? el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "";
          return el.tagName.toLowerCase() + (cls ? "." + cls : "");
        });
        return { sw: document.documentElement.scrollWidth, iw, offenders };
      })()`);

    const a11y = () =>
      evaluate<A11yReport>(`(() => {
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        const controls = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")];
        const unlabeledControls = controls.filter((el) =>
          !(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")).length;
        const imagesWithoutAlt = [...document.querySelectorAll("img")].filter((el) => !el.hasAttribute("alt")).length;
        const emptyLinks = [...document.querySelectorAll("a")].filter((el) =>
          !(el.textContent || "").trim() && !el.getAttribute("aria-label")).length;
        return { dupIds, unlabeledControls, imagesWithoutAlt, emptyLinks };
      })()`);

    const checkPage = async (label: string, route: string, shotName: string) => {
      const before = consoleErrors.length;
      await navigate(route);
      const layout = await overflow();
      const accessibility = await a11y();
      await screenshot(shotName);
      const ok = layout.sw <= layout.iw + 1;
      record(
        `360px ${label}`,
        ok && accessibility.dupIds.length === 0 && accessibility.unlabeledControls === 0,
        `scrollWidth=${layout.sw} innerWidth=${layout.iw}` +
          (layout.offenders.length ? ` overflowing=${layout.offenders.join(",")}` : "") +
          ` dupIds=${accessibility.dupIds.length} unlabeled=${accessibility.unlabeledControls}` +
          ` imgNoAlt=${accessibility.imagesWithoutAlt} emptyLinks=${accessibility.emptyLinks}`,
      );
      if (consoleErrors.length > before) {
        record(`console ${label}`, false, consoleErrors.slice(before).join(" | "));
      }
    };

    // 1. Sign-in error association and focus.
    await navigate("/sign-in");
    await evaluate(`document.querySelector("#email").focus()`);
    await client.send("Input.insertText", { text: "nobody@example.com" }, sid);
    await evaluate(`document.querySelector("#password").focus()`);
    await client.send("Input.insertText", { text: "definitely-wrong" }, sid);
    await evaluate(`document.querySelector("form button[type=submit]").click()`);
    let alertReady = false;
    for (let i = 0; i < 40; i += 1) {
      if (await evaluate<boolean>(`Boolean(document.querySelector("#signin-error"))`)) {
        alertReady = true;
        break;
      }
      await delay(150);
    }
    if (!alertReady) {
      record("sign-in error alert", false, "#signin-error never appeared");
    } else {
      const state = await evaluate<{
        text: string;
        activeId: string;
        describedBy: string | null;
        invalid: string | null;
        role: string | null;
      }>(`(() => {
        const alert = document.querySelector("#signin-error");
        const email = document.querySelector("#email");
        return {
          text: (alert.textContent || "").trim(),
          activeId: document.activeElement ? document.activeElement.id : "",
          describedBy: email.getAttribute("aria-describedby"),
          invalid: email.getAttribute("aria-invalid"),
          role: alert.getAttribute("role"),
        };
      })()`);
      await screenshot("signin-error-360.png");
      record(
        "sign-in error alert",
        state.text.length > 0 &&
          state.role === "alert" &&
          state.describedBy === "signin-error" &&
          state.invalid === "true" &&
          state.activeId === "signin-error",
        `role=${state.role} describedBy=${state.describedBy} invalid=${state.invalid} focus=${state.activeId} text="${state.text}"`,
      );
    }

    // 2. Borrower pages at 360px.
    await checkPage("sign-in", "/sign-in", "signin-360.png");
    const ananya = "ananya@riverbend-demo.example";
    const ananyaStatus = await signIn(ananya);
    record("sign-in request", ananyaStatus === 200, `status=${ananyaStatus}`);
    await checkPage("catalogue", "/catalogue", "catalogue-360.png");
    const header = await evaluate<{
      brand: { y: number; h: number };
      user: { y: number; h: number };
      nav: { y: number; h: number; w: number; x: number };
      order: string;
      overflowX: string;
      navScrollWidth: number;
      navClientWidth: number;
      navScrollLeft: number;
    }>(`(() => {
      const rect = (el) => { const box = el.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }; };
      const nav = document.querySelector(".main-nav");
      const style = getComputedStyle(nav);
      return {
        brand: rect(document.querySelector(".brand")),
        user: rect(document.querySelector(".header-user")),
        nav: rect(nav),
        order: style.order,
        overflowX: style.overflowX,
        navScrollWidth: nav.scrollWidth,
        navClientWidth: nav.clientWidth,
        navScrollLeft: nav.scrollLeft,
      };
    })()`);
    record(
      "mobile header nav strip",
      header.nav.y > header.brand.y &&
        header.overflowX === "auto" &&
        header.navClientWidth >= header.nav.w - 1,
      `brandY=${header.brand.y} userY=${header.user.y} navY=${header.nav.y} order=${header.order} overflowX=${header.overflowX} navScroll=${header.navScrollWidth}/${header.navClientWidth} scrollLeft=${header.navScrollLeft}`,
    );
    await checkPage("resource detail", "/resources/r01", "resource-360.png");

    await navigate("/bookings");
    const bookingHref = await evaluate<string | null>(
      `document.querySelector('a[href^="/bookings/"]')?.getAttribute("href") ?? null`,
    );
    await checkPage("bookings", "/bookings", "bookings-360.png");
    if (bookingHref) {
      await checkPage("booking detail", bookingHref, "booking-detail-360.png");
    } else {
      record(
        "360px booking detail",
        false,
        "no booking link found for the demo borrower",
      );
    }
    await checkPage("incidents", "/incidents", "incidents-360.png");

    // 3. Tab order on the catalogue.
    await navigate("/catalogue");
    await evaluate(`document.body.focus()`);
    const tabOrder: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      await client.send(
        "Input.dispatchKeyEvent",
        {
          type: "rawKeyDown",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
          nativeVirtualKeyCode: 9,
        },
        sid,
      );
      await client.send(
        "Input.dispatchKeyEvent",
        {
          type: "keyUp",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
          nativeVirtualKeyCode: 9,
        },
        sid,
      );
      await delay(80);
      tabOrder.push(
        await evaluate<string>(`(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return "body";
          const label = el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 30);
          return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (label ? ' "' + label + '"' : "");
        })()`),
      );
    }
    record(
      "catalogue Tab order",
      tabOrder.length > 0 && !tabOrder.includes("body"),
      tabOrder.join(" -> "),
    );

    // 4. Owner and admin views.
    await signOut();
    const kabirStatus = await signIn("kabir@riverbend-demo.example");
    record("owner sign-in", kabirStatus === 200, `status=${kabirStatus}`);
    await checkPage("manage requests", "/manage/requests", "manage-360.png");

    await signOut();
    const meeraStatus = await signIn("meera@riverbend-demo.example");
    record("admin sign-in", meeraStatus === 200, `status=${meeraStatus}`);
    await checkPage("admin users", "/admin/users", "admin-360.png");
    await checkPage("admin audit", "/admin/audit", "audit-360.png");

    await signOut();

    await client.send("Browser.close", {});
  } finally {
    cdp?.close();
    chrome.kill();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold the profile for a moment; temp dirs are safe to leave.
    }
  }

  const failures = results.filter((entry) => entry.status === "FAIL");
  const report = [
    "# Browser check evidence",
    "",
    `Date: ${new Date().toISOString()}`,
    `Command: npx tsx scripts/browser-check.ts (base ${BASE}, headless Chrome, viewport 360x800)`,
    `Checks: ${results.length}, passed: ${results.length - failures.length}, failed: ${failures.length}`,
    "",
    "| Check | Status | Detail |",
    "| --- | --- | --- |",
    ...results.map(
      (entry) =>
        `| ${entry.check} | ${entry.status} | ${entry.detail.replace(/\|/g, "\\|")} |`,
    ),
    "",
    "Screenshots: " +
      fs
        .readdirSync(EVIDENCE)
        .filter((file) => file.endsWith(".png"))
        .sort()
        .join(", "),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(EVIDENCE, "browser-check.md"), report);
  process.stdout.write(
    `\n${results.length - failures.length}/${results.length} checks passed. Report: docs/evidence/browser-check.md\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
