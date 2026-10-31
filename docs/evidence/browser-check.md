# Browser check evidence

Date: 2026-10-30T11:22:51.423Z
Command: npx tsx scripts/browser-check.ts (base http://localhost:3000, headless Chrome, viewport 360x800)
Checks: 15, passed: 15, failed: 0

| Check                   | Status | Detail                                                                                                                                                                                                               |
| ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sign-in error alert     | PASS   | role=alert describedBy=signin-error invalid=true focus=signin-error text="Email or password is incorrect."                                                                                                           |
| 360px sign-in           | PASS   | scrollWidth=360 innerWidth=360 dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                                                                          |
| sign-in request         | PASS   | status=200                                                                                                                                                                                                           |
| 360px catalogue         | PASS   | scrollWidth=360 innerWidth=360 dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                                                                          |
| mobile header nav strip | PASS   | brandY=62 userY=61 navY=107 order=3 overflowX=auto navScroll=332/332 scrollLeft=0                                                                                                                                    |
| 360px resource detail   | PASS   | scrollWidth=360 innerWidth=360 dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                                                                          |
| 360px bookings          | PASS   | scrollWidth=360 innerWidth=360 dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                                                                          |
| 360px booking detail    | PASS   | scrollWidth=360 innerWidth=360 overflowing=div.stepper-step,span,div.stepper-step,span.stepper-dot,span dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                 |
| 360px incidents         | PASS   | scrollWidth=360 innerWidth=360 dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                                                                          |
| catalogue Tab order     | PASS   | a "Skip to main content" -> a "SSShareSpace" -> a "Catalogue" -> a "My bookings" -> a "Incidents" -> button "Sign out" -> input#q -> select#type "All categoriesCamerasAudioLigh" -> input -> button "Apply filters" |
| owner sign-in           | PASS   | status=200                                                                                                                                                                                                           |
| 360px manage requests   | PASS   | scrollWidth=360 innerWidth=360 overflowing=a.nav-link dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                                                   |
| admin sign-in           | PASS   | status=200                                                                                                                                                                                                           |
| 360px admin users       | PASS   | scrollWidth=360 innerWidth=360 overflowing=a.nav-link,a.nav-link,a.nav-link,a.nav-link dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                                  |
| 360px admin audit       | PASS   | scrollWidth=360 innerWidth=360 overflowing=a.nav-link,a.nav-link,a.nav-link,a.nav-link,table.data dupIds=0 unlabeled=0 imgNoAlt=0 emptyLinks=0                                                                       |

Screenshots: admin-360.png, audit-360.png, booking-detail-360.png, bookings-360.png, catalogue-360.png, incidents-360.png, manage-360.png, resource-360.png, signin-360.png, signin-error-360.png, ui-booking-form.png, ui-booking-pending.png, ui-booking-success.png, ui-forbidden.png, ui-owner-approved.png, ui-owner-queue.png
