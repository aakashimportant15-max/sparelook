# Demo run D1-D12

Date: 2026-10-30T11:04:42.829Z
Command: npx tsx scripts/demo-run.ts (base http://localhost:3000)
Steps: 28, passed: 28, failed: 0

| Step                                     | Status | Detail                                                                                                                                               |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 admin creates resource                | PASS   | status=201 id=res_1919ea5c-7d3f-44f0-90ab-9805ebe4927a                                                                                               |
| D1 resource appears in catalogue         | PASS   | status=200 matches=1                                                                                                                                 |
| D1 audit event resource.created          | PASS   | status=200 events=1                                                                                                                                  |
| D2 Ananya eligible for R01               | PASS   | status=200 eligible=true reasons=0                                                                                                                   |
| D2 search camera                         | PASS   | status=200 matches=4                                                                                                                                 |
| D3 Ananya request is PENDING             | PASS   | status=201 booking=bkg_2299e525-5074-46f2-8039-8b0bc4fbf30a state=PENDING                                                                            |
| D3 owner queue contains the request      | PASS   | status=200 pending=3                                                                                                                                 |
| D4 overlapping request blocked           | PASS   | status=409 code=BOOKING_CONFLICT window=2026-10-31T04:45:00.000Z..2026-10-31T06:45:00.000Z seeded=2026-10-31T04:30:00.000Z..2026-10-31T08:30:00.000Z |
| D4 conflict message hides identities     | PASS   | message="That time slot is already booked."                                                                                                          |
| D4 non-overlapping request accepted      | PASS   | status=201 booking=bkg_f8dcd428-aad8-495f-8098-e3b5437c53ab window=2026-10-31T15:00..2026-10-31T16:00                                                |
| D5 approve Ananya request                | PASS   | status=200 state=APPROVED                                                                                                                            |
| D5 reject Rohan request with reason      | PASS   | status=200 state=REJECTED reasonStored=true                                                                                                          |
| D5 requester sees rejection reason       | PASS   | status=200 reasonVisible=true                                                                                                                        |
| D6 Dev blocked with reasons              | PASS   | status=422 code=NOT_ELIGIBLE reasons=MISSING_GROUP,MISSING_TRAINING                                                                                  |
| D7 auto-approve lavalier kit             | PASS   | status=201 booking=bkg_c9cf62cd-5e7a-4fa0-a556-8076b1955e54 state=APPROVED                                                                           |
| D7 checkout recorded                     | PASS   | status=200 state=CHECKED_OUT                                                                                                                         |
| D8 return flags discrepancy and incident | PASS   | status=200 state=RETURNED discrepancy=true incident=inc_d8e2a769-d4d7-45f4-92c1-da00658093ac                                                         |
| D9 incident resolved                     | PASS   | investigating=200 resolved=200 state=RESOLVED                                                                                                        |
| D9 borrower sees the resolved incident   | PASS   | status=200 visible=1                                                                                                                                 |
| D10 owner sees full passport             | PASS   | status=200 full=true audit=20 timeline=26 ordered=true                                                                                               |
| D10 borrower sees limited passport       | PASS   | status=200 full=false audit=0 ownBookings=3                                                                                                          |
| D11 FairShare ranks Ananya first         | PASS   | entries=2 ananyaRank=1 sanaRank=2                                                                                                                    |
| D11 rank-2 approval needs override       | PASS   | status=422 code=OVERRIDE_REQUIRED                                                                                                                    |
| D11 override approval succeeds           | PASS   | status=200 state=APPROVED                                                                                                                            |
| D11 competing request waitlisted         | PASS   | status=200 state=WAITLISTED reason=SUPERSEDED_BY_APPROVED_BOOKING                                                                                    |
| D12 owner/admin APIs blocked             | PASS   | manage=403/FORBIDDEN admin=403/FORBIDDEN                                                                                                             |
| D12 foreign booking hidden               | PASS   | status=404 code=NOT_FOUND                                                                                                                            |
| D12 owner page denied for borrower       | PASS   | status=200 location=none redirect=true                                                                                                               |

D7-D9 ran on the auto-approve lavalier kit created in D1 because the seeded R01 booking occupies 16:30-20:30 IST today, outside the 30-minute checkout window.
The demo database must be reset afterwards with: npm run demo:reset
