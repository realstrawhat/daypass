# Daypass user flow map

Every user journey and every screen in the app, tied back to `Gym_App_Product_Build_Pack`.

## Start here

**Double-click `index.html`.** It opens in your browser and works offline. It has the whole-app map, seven journeys you read left to right, the story map and requirement tables, and all the screens. Tap a screen to enlarge it.

## What's in this folder

| Item | What it is | Use it for |
|------|------------|------------|
| `index.html` | The interactive map | Showing and exploring |
| `journeys.md` | The same content as plain text and tables | Pasting into a report |
| `maps/` | Each map as a picture | Slides and hand-ins |
| `screens/` | 86 screenshots of the real app | Slides, or checking a screen |
| `pdf/` | The two story maps taken from the PDF | Comparing against the original |
| `capture-screens.mjs`, `build-map.mjs`, `export-maps.mjs` | The scripts that make all of this | Updating it when the app changes |

## The journeys

| Code | Journey | Who | Where it comes from |
|------|---------|-----|---------------------|
| J1 | Find, book and visit a gym | Member | PDF, Journey 1. Stories 1, 2, 3 and 5 |
| J2 | Return to the app and reschedule | Member | PDF, Journey 2. Story 4 |
| J3 | At the door: scan in, train, scan out | Member and front desk | Added from owner feedback |
| J4 | Run the front desk | Admin: anyone with the password | Added from owner feedback |
| J5 | List a gym | Gym owner | PDF, section 1 assumptions and NFR8 |
| J6 | Track my training | Member | Added from owner feedback |
| J7 | Manage my account | Member | PDF, stories below the MVP line, NFR5 and NFR6 |

## How it links to the PDF

- **Section 4, story maps:** every card on both maps is listed with its screen and status.
- **Sections 2 and 3, requirements:** FR1 to FR10 and NFR1 to NFR10, each with a screen and a status.
- **Section 5, stories:** each journey step names its story, and the "what if" boxes show the second acceptance criteria, such as a declined payment or a change inside 24 hours.

Requirement statuses come from "Limits to state honestly" in `_bmad-output/implementation-artifacts/process-log.md`. Anything not met says so.

## Things to know about the screenshots

- **Street maps are missing.** The test browser can't draw the street map, so `find-03`, `find-06`, `find-07` and `gym-06` show the real gym pins on a plain background. A real phone shows the streets. Replace these four with photos from your phone if you use them in slides, keeping the same file names, then run `node userflow/build-map.mjs`.
- **They come from a test browser at iPhone 16 Pro Max width,** not a real iPhone.
- **They were taken from a local build.** The countdown and two-device confirmation show here before they are live, if they haven't been deployed yet.
- **Sam Demo is a throwaway account,** removed after the capture. The gyms are sample listings and payments are simulated. The bookings and scans in the pictures really happened in the app.

## Updating it

From the project folder, with the app running locally (`npm run build`, then `npx next start -p 3000`):

```
node --env-file=.env.local userflow/capture-screens.mjs
node userflow/build-map.mjs
node userflow/export-maps.mjs
```

To change the wording or steps of a journey, edit the list at the top of `build-map.mjs`, then run the last two lines.
