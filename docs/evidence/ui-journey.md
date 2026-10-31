# UI click-through

Date: 2026-10-30T11:09:11.138Z
Command: npx tsx scripts/ui-journey.ts (headless Chrome, 1280x900)
Steps: 8, passed: 8, failed: 0

| Step                         | Status | Detail                                                                       |
| ---------------------------- | ------ | ---------------------------------------------------------------------------- |
| UI-01 sign-in via form       | PASS   | reached /catalogue                                                           |
| UI-01 eligibility panel      | PASS   | panel copy present                                                           |
| UI-01 request submitted      | PASS   | success alert shown, href=/bookings/bkg_415edd34-6a9e-4ad6-97ea-0ee69a1276c5 |
| UI-01 booking shows PENDING  | PASS   | url=/bookings/bkg_415edd34-6a9e-4ad6-97ea-0ee69a1276c5                       |
| UI-03 approve button clicked | PASS   | owner queue row found                                                        |
| UI-03 approval applied       | PASS   | queue refreshed without the request                                          |
| UI-03 booking shows APPROVED | PASS   | url=/bookings/bkg_415edd34-6a9e-4ad6-97ea-0ee69a1276c5                       |
| UI-06 forbidden page         | PASS   | borrower redirected to /forbidden                                            |

The UI journey creates one PENDING booking and approves it; reset the demo database afterwards with npm run demo:reset.
