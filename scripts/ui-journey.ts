import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocalEnv } from "../src/db/load-env";
import { zonedParts } from "../src/lib/time";

// Browser click-through of the primary UI actions (UI-01, UI-03, UI-06).
// Requires a running server and DEMO_USER_PASSWORD in .env.

loadLocalEnv();

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9334;
const BASE = process.env.UI_BASE ?? "http://localhost:3000";
const PASSWORD: string = process.env.DEMO_USER_PASSWORD ?? "";
const EVIDENCE = "docs/evidence";

if (!PASSWORD) throw new Error("DEMO_USER_PASSWORD is not set (checked .env)");

type Message = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
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

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Message;
      if (typeof message.id === "number") {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result ?? {});
      }
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

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = this.nextId++;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(
        JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
      );
    });
  }

  close() {
    this.socket.close();
  }
}

const results: { step: string; ok: boolean; detail: string }[] = [];

function record(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${step} - ${detail}\n`);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (value: number) => String(value).padStart(2, "0");

async function waitForHttp(url: string, timeoutMs: number) {
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
  await waitForHttp(`${BASE}/api/health`, 20_000);
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const tomorrow = zonedParts(new Date(Date.now() + 24 * 60 * 60_000), "Asia/Kolkata");
  const startAt = `${tomorrow.year}-${pad(tomorrow.month)}-${pad(tomorrow.day)}T18:00`;
  const endAt = `${tomorrow.year}-${pad(tomorrow.month)}-${pad(tomorrow.day)}T19:00`;
  const purpose = "UI click-through request for the owner queue";

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sharespace-ui-"));
  const chrome: ChildProcess = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
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
    const attached = await client.send("Target.attachToTarget", {
      targetId: target.targetId as string,
      flatten: true,
    });
    const sid = attached.sessionId as string;

    await client.send("Page.enable", {}, sid);
    await client.send("Runtime.enable", {}, sid);

    const evaluate = async <T>(expression: string): Promise<T> => {
      const response = await client.send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sid,
      );
      if (response.exceptionDetails) {
        throw new Error(
          `Page evaluation failed: ${JSON.stringify(response.exceptionDetails)}`,
        );
      }
      return (response.result as { value: T }).value;
    };

    const waitFor = async (expression: string, label: string, timeoutMs = 20_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try {
          if (await evaluate<boolean>(expression)) return;
        } catch {
          // page navigating
        }
        await delay(150);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };

    const navigate = async (route: string) => {
      await client.send("Page.navigate", { url: `${BASE}${route}` }, sid);
      await waitFor(`document.readyState === "complete"`, route);
      await delay(300);
    };

    const setValue = async (selector: string, value: string) => {
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Missing " + ${JSON.stringify(selector)});
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      })()`);
    };

    const setTextarea = async (selector: string, value: string) => {
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Missing " + ${JSON.stringify(selector)});
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      })()`);
    };

    const screenshot = async (name: string) => {
      const shot = await client.send("Page.captureScreenshot", { format: "png" }, sid);
      fs.writeFileSync(
        path.join(EVIDENCE, name),
        Buffer.from(shot.data as string, "base64"),
      );
    };

    const signIn = async (email: string) => {
      await navigate("/sign-in");
      await setValue("#email", email);
      await setValue("#password", PASSWORD);
      await evaluate(`document.querySelector("form button[type=submit]").click()`);
      await waitFor(`location.pathname === "/catalogue"`, `sign-in as ${email}`);
    };

    const signOut = async () => {
      await evaluate(`document.querySelector("header form button").click()`);
      await waitFor(`location.pathname === "/sign-in"`, "sign out");
    };

    const bodyText = () => evaluate<string>("document.body.innerText");

    // UI-01: borrower signs in, checks eligibility, requests a booking.
    await signIn("ananya@riverbend-demo.example");
    record("UI-01 sign-in via form", true, "reached /catalogue");

    await navigate("/resources/r01");
    const eligibilityText = await bodyText();
    record(
      "UI-01 eligibility panel",
      eligibilityText.includes("You can request this resource"),
      "panel copy present",
    );

    await setValue("#startAt", startAt);
    await setValue("#endAt", endAt);
    await setTextarea("#purpose", purpose);
    await screenshot("ui-booking-form.png");
    await evaluate(
      `document.querySelector('form:has(#purpose) button[type="submit"]').click()`,
    );
    await waitFor(
      `document.body.innerText.includes("Sent to the owner for approval")`,
      "booking success alert",
    );
    await screenshot("ui-booking-success.png");
    const bookingHref = await evaluate<string | null>(
      `document.querySelector('a[href^="/bookings/"]')?.getAttribute("href") ?? null`,
    );
    record(
      "UI-01 request submitted",
      Boolean(bookingHref),
      `success alert shown, href=${bookingHref ?? "missing"}`,
    );

    if (bookingHref) {
      await navigate(bookingHref);
      const detailText = await bodyText();
      record(
        "UI-01 booking shows PENDING",
        /pending/i.test(detailText),
        `url=${bookingHref}`,
      );
      await screenshot("ui-booking-pending.png");
    }

    // UI-03: owner approves from the queue.
    await signOut();
    await signIn("kabir@riverbend-demo.example");
    await navigate("/manage/requests");
    await waitFor(
      `document.body.innerText.includes(${JSON.stringify(purpose)})`,
      "queue item for the UI booking",
    );
    await screenshot("ui-owner-queue.png");
    const clicked = await evaluate<boolean>(`(() => {
      const article = [...document.querySelectorAll("article")].find((el) =>
        (el.textContent || "").includes(${JSON.stringify(purpose)}));
      if (!article) return false;
      const button = [...article.querySelectorAll("button")].find((el) =>
        (el.textContent || "").includes("Approve request"));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    record("UI-03 approve button clicked", clicked, "owner queue row found");
    await waitFor(
      `!document.body.innerText.includes(${JSON.stringify(purpose)})`,
      "approved booking to leave the queue",
    );
    record("UI-03 approval applied", true, "queue refreshed without the request");
    await screenshot("ui-owner-approved.png");

    if (bookingHref) {
      await navigate(bookingHref);
      const approvedText = await bodyText();
      record(
        "UI-03 booking shows APPROVED",
        approvedText.includes("Approved"),
        `url=${bookingHref}`,
      );
    }

    // UI-06: borrower opening an owner URL gets the forbidden page.
    await signOut();
    await signIn("rohan@riverbend-demo.example");
    await navigate("/manage/requests");
    await waitFor(
      `location.pathname === "/forbidden" && document.body.innerText.includes("different role")`,
      "forbidden page",
    );
    record("UI-06 forbidden page", true, "borrower redirected to /forbidden");
    await screenshot("ui-forbidden.png");

    await signOut();
    await client.send("Browser.close", {});
  } finally {
    cdp?.close();
    chrome.kill();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold the profile briefly.
    }
  }

  const failures = results.filter((result) => !result.ok);
  fs.writeFileSync(
    path.join(EVIDENCE, "ui-journey.md"),
    [
      "# UI click-through",
      "",
      `Date: ${new Date().toISOString()}`,
      `Command: npx tsx scripts/ui-journey.ts (headless Chrome, 1280x900)`,
      `Steps: ${results.length}, passed: ${results.length - failures.length}, failed: ${failures.length}`,
      "",
      "| Step | Status | Detail |",
      "| --- | --- | --- |",
      ...results.map(
        (result) =>
          `| ${result.step} | ${result.ok ? "PASS" : "FAIL"} | ${result.detail.replace(/\|/g, "\\|")} |`,
      ),
      "",
      "The UI journey creates one PENDING booking and approves it; reset the demo database afterwards with npm run demo:reset.",
      "",
    ].join("\n"),
  );
  process.stdout.write(
    `\n${results.length - failures.length}/${results.length} UI steps passed.\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
