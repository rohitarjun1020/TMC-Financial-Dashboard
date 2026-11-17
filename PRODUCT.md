# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** The Migration Company (TMC) leadership — the CEO, COO and board. They review the dashboard on a laptop or a shared screen in monthly finance meetings. Phone use is secondary (a link opened between meetings).
- **Preparer:** SRF Capital Studio (the user), TMC's outsourced CFO team. They refresh it each month from the MIS and Cashflow workbooks and present it.
- **Secondary:** prospective SRF clients, who are shown the real TMC dashboard as an example of SRF's work, with TMC's agreement.

## Product Purpose

One place where TMC leadership sees the company's financial position: last month's P&L against budget (MIS), where cash stands and where it is heading month by month, and how the sales pipeline changes the year-end cash position. Success means leadership leaves the monthly review knowing the cash runway, the pinch-point month and which deals decide the year, without opening a spreadsheet.

## Positioning

A CFO's monthly update, not a BI export. Every figure ties to the rupee to the source workbooks. A narrated video briefing is synced to live figures. Pipeline scenarios (Highly / Medium / Low Likely) are layered on a confirmed-business base case.

## Operating Context

- Refreshed monthly (and sometimes mid-month) from two Excel workbooks: the MIS report (accrual P&L, Page 1) and the Cashflow forecast (cash, Pages 2–3). Each page uses only its own workbook; the two are never mixed.
- A narrated update video (MP4) and its chapter figures accompany each cashflow refresh.
- Published as a static site on GitHub Pages (`rohitarjun1020/TMC-Financial-Dashboard`); the client opens the live link. Changes go to a branch and are previewed before publishing.
- A companion chatbot, "Ami" (French for friend; renamed from "Ask the data" on 17 Nov 2026), runs as a private claude.ai artifact (source outside this repo, in `C:\Users\Rohit SRF\TMC Ask the Data`).

## Capabilities and Constraints

- Pages: Cashflow Briefing (video + live panel), MIS Summary (P&L, budget compare, ledger and salary breakdowns, revenue by customer), CF Month View (one month's receipts, payments, salaries), CF Trends (receipts vs outflows, net burn and runway, scenario switches).
- Static HTML/CSS/JS only. Zero budget: no paid services, API keys, hosting, fonts or images. Free CDNs (cdnjs, jsDelivr, unpkg) and Google Fonts only.
- Salaries are shown by department only, never by employee name.
- B2B revenue is split by customer as the MIS lists it; never default unlisted revenue to Somika.
- Access: a passcode screen in front of the dashboard (casual protection only; the site stays public on GitHub Pages).
- Units: Indian Rupees, Indian digit grouping (₹12,34,567) and lakhs (₹12.35L); negatives in brackets.

## Brand Commitments

- Client brand: The Migration Company (themigration.company). The logo "M" fades from magenta to blue.
- Preparer credit: "SRF Capital Studio".
- Every number on screen must come from the data file (`dashboard-data.js`).

## Evidence on Hand

- `dashboard-data.js`: all figures (MIS FY 2025-26 to Oct 2026; cash flow Apr 2025 to Jun 2027 with pipeline tiers).
- `media/*.mp4`: the current narrated cashflow update video.
- `tmc-logo.png`: TMC logo.
- There are no testimonials, client quotes or photography licensed for this project; do not fabricate any.

## Product Principles

1. **Ties to the rupee.** Accuracy outranks everything: no figure without a source, and every check is shown.
2. **Cash first, then why.** Lead with where cash stands and where it is heading; the detail sits one click below.
3. **Scenarios are decisions.** The pipeline tiers exist to show which deals decide the year, so name them plainly.
4. **Meeting-room legible.** It must read on a shared screen across a table: big, sure numbers and plain English labels.

## Accessibility & Inclusion

WCAG 2.1 AA: keyboard-only operation, readable contrast in light and dark, charts drawn to scale with readable labels, no meaning carried by colour alone.
