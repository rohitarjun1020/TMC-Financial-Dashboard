---
version: 1
slug: "dashboard-html"
primary_target: "dashboard.html"
related_targets: []
---

# TMC Financial Dashboard (dashboard.html)

Mode: Operate. Audience: TMC leadership in monthly finance reviews on a laptop or shared screen; phone secondary. Job: know where cash stands, where it is heading under each pipeline scenario, and how last month's P&L compares with budget. Everything comes from dashboard-data.js; MIS (Page 1) and Cashflow (Pages 2-3) never mix. Keep every incumbent feature: Briefing video + live panel, MIS with budget compare and ledger/salary/customer breakdowns, month view, trends with scenario switches. Additions: built-in "Ask the data" panel (rule-based, no AI) with a link out to the claude.ai artifact, EN/DE label switch, passcode screen, light and dark.

## Direction contract

THESIS: The dashboard is TMC's cash passport. Each month carries an entry stamp that states its status (bank-tallied actual, in progress, forecast), and every headline figure carries its proof. It refuses the category default of a sidebar, four KPI cards and a blue line chart.

OWN-WORLD: Passport-navy shell (#13254A) over cool security-paper ground (#EEF2F6 light; deep navy in dark). TMC teal-blue #1E749B and magenta #C5489E as primary data series, visa violet #6B3FA0 as the stamp ink and the third series, red only for shortfall. DM Serif Display capitals for page titles (TMC brand), Poppins for UI, tabular figures. Fine guilloché linework at one device pixel in three ink values, used only in the data-page header. Round violet stamps; dashed outline for forecast.

STORY: The reader sees cash today and where it lands in March 2027, understands that the base case dips below zero and that Scenario 1 is the floor, then drills into the month, the P&L or the pipeline, or asks a question.

FIRST VIEWPORT: Navy top bar (TMC logo, tabs Briefing · P&L · Month · Trends · Ask the data, as-of dates, EN/DE, theme). Below it the full-width data page: five labelled fields (cash today, next month close, pinch point, March base, March Scenario 1), each with a proof line, over guilloché, with a machine-readable summary strip. Then the scenario chart with month stamps along the axis, and the video + priorities.

FORM: Passport data page and visa stamps, grounded candidate 3 of 7. seed:e03ff773d1184593. Raises: proof line on every headline figure (from Claim and Proof); one-device-pixel linework in three ink values (from Reference Setting); one geometry for scenario lines, legend and March stamps (from Guide Map). Signature move: month entry stamps that encode actual / in progress / forecast, landing once on load and when the scenario changes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
