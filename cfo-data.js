/* ============================================================================
   TMC — CFO DASHBOARD  ·  DATA LAYER
   Built by SRF Capital Studio
   ----------------------------------------------------------------------------
   SOURCES (all figures traced to client workbooks, no estimates):
     [CF]  TMC Cashflow_ July 28.xlsm            (Cashflow, B2B/RTD Rev & Payments,
                                                  B2B Summary, Payroll)
     [MIS] TMC_MIS Report - FY 26-27  June.xlsx  (Income Statement (Books),
                                                  Balance Sheet, Manpower)
     [BUD] New Budget 26-27.xlsx                 (RTD Buildup, Pipeline Buildup FY27,
                                                  Cost Buildup FY27)

   NOTE ON THE BUDGET FILE: 'Budget FY27' evaluates to #NAME? in the source file
   because the installed Excel build does not support XLOOKUP. The FY27 budget
   below is rebuilt line-by-line from the three buildup sheets and reconciles
   EXACTLY to the budget column of the MIS (Q1 FY27: revenue 6,785,075 /
   teacher cost 4,645,544 / ops salary 843,000 / S&M 2,544,000 / G&A 2,155,000 /
   EBITDA -3,402,469).
   ========================================================================== */

const D = {};

/* ─────────────────────────────  TIMELINE  ───────────────────────────── */
D.months = ['Apr-25','May-25','Jun-25','Jul-25','Aug-25','Sep-25','Oct-25','Nov-25',
            'Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26',
            'Aug-26','Sep-26','Oct-26','Nov-26','Dec-26','Jan-27','Feb-27','Mar-27'];
D.nActual   = 15;          // Apr-25 → Jun-26 are actuals; Jul-26 → Mar-27 forecast
D.iFY27     = 12;          // index of Apr-26 (start of FY 26-27)
D.iForecast = 15;          // index of Jul-26 (first forecast month)
D.asOf      = 'MIS to 30 Jun 2026  ·  Cashflow to 28 Jul 2026';

/* ─────────────────────  CASHFLOW — BASE (no pipeline)  ──────────────────── */
/* [CF] sheet 'Cashflow' rows 4-43, columns C:Z. Scenario = Without B2B/RTD Pipeline */
D.cf = {
  opening:      [718483,112748.24,2170141.32,4361050.64,3999520.42,3431529.86,4363180.87,3158770.13,2552645.13,936929.53,3753255.03,3010942.03,1050093.3,1782792.36,2156936.37,5842797.92,5106471.82,4772017.44,3373864.37,2616022.26,1499258.77,705187.96,712697.96,-515663.04],
  billed:       [7323,3019840,67153,616198,690127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  investment:   [0,0,3500000,0,0,2500000,0,0,0,2500000,0,0,1500000,0,5000000,0,0,0,0,0,0,0,0,0],
  b2bColl:      [0,0,0,0,0,0,1433067.55,0,760815,1114347.5,630282,456188.59,40000,1181541.5,972313.17,685606.45,1164010.95,274750,556850,209925,496023.75,99750,0,0],
  rtdColl:      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,50000,0,0,100000,0,0,0,0],
  otherInc:     [0,0,0,0,0,19000,20000,100,1.96,49280,0,0,8400,0,0,3200,0,0,0,0,0,0,0,0],
  receipts:     [7323,3019840,3567153,616198,690127,2519000,1453067.55,100,760816.96,3663627.5,630282,456188.59,1548400,1181541.5,5972313.17,688806.45,1214010.95,274750,556850,309925,496023.75,99750,0,0],

  b2bCost:      [114500,268758.97,425500,192842.22,127979,114750,439560,330000,262350,0,158850,151645,0,331276.95,381660,308465.53,179140,158640,118640,104640,88640,62240,50240,50240],
  rtdCost:      [0,0,0,0,58000,472497.61,0,190053,99405,0,23760,59400,0,31860,4950,0,0,0,0,120000,0,0,0,0],
  payroll:      [391797.76,394300,520139,454300,554800,574187,1316933,38000,1325541,693303,683000,644161,679000,0,1278605,627352,842500,842500,842500,842500,842500,0,842500,1618000],
  travel:       [0,41698.95,138978.68,34816,66179.94,39796.55,63436.14,0,66009.98,146594,490,322763.23,88090,45035.82,44379.86,111690,120000,120000,120000,120000,120000,0,120000,240000],
  software:     [0,27739,15421,15618,66728.82,96600.83,101799.75,9400,122356.01,7399,39738.18,531662.43,1292.09,97761.15,144292.31,57696.2,12975,12975,12975,12975,12975,0,12975,25950],
  marketing:    [0,0,0,0,0,5310,0,0,0,0,0,0,0,4513,0,0,0,108000,0,0,0,0,0,0],
  otherGA:      [0,0,0,0,731.8,33159,336171.76,38772,222389.18,0,143194,468224.4,47318.85,88738.95,236058.46,138429,222283.29,128588.07,118377.11,124373.49,123779.56,0,100446,230655.13],
  assets:       [0,0,0,0,0,0,0,0,0,0,0,35853,0,0,36344,0,0,0,0,0,0,0,0,0],
  telephone:    [0,2139,2029,4120,0,0,5462.64,0,9136.4,0,5645.82,12557.26,0,9881.4,5906.64,3228.82,5700,5700,5700,5700,5700,0,5700,11400],
  courier:      [0,945,0,0,0,0,1890,0,11376,0,500,5717,0,1675,976,121,2000,2000,2000,2000,2000,0,2000,4000],
  otherConsult: [0,0,0,0,0,58500,2625,0,73000,0,0,9500,0,41920.05,9720,0,33367.04,0,0,0,0,0,0,0],
  print:        [0,6230,0,675,0,0,0,0,24367,0,0,0,0,237,0,500,500,500,500,500,500,0,500,1000],
  otherExp:     [0,0,0,0,0,0,0,0,1000,0,0,1064,0,0,560,350,0,0,0,0,0,0,0,0],
  professional: [106760,220636,274176,275357,383653,192540,389600,0,159700,0,317500,174490,0,154500,143000,177300,130000,294000,94000,94000,94000,30000,94000,158000],
  outflow:      [613057.76,962446.92,1376243.68,977728.22,1258072.56,1587340.99,2657478.29,606225,2376630.57,847296,1372678,2417037.32,815700.94,807399.32,2286452.27,1425132.55,1548465.33,1672903.07,1314692.11,1426688.49,1290094.56,92240,1228361,2339245.13],
  adjust:       [0,0,0,0,-45,-8,0,0,98,-6,83,0,0,1.83,0.65,0,0,0,0,0,0,0,0,0],
  closing:      [112748.24,2170141.32,4361050.64,3999520.42,3431529.86,4363180.87,3158770.13,2552645.13,936929.53,3753255.03,3010942.03,1050093.3,1782792.36,2156936.37,5842797.92,5106471.82,4772017.44,3373864.37,2616022.26,1499258.77,705187.96,712697.96,-515663.04,-2854908.17]
};

/* Payment lines that make up the P&L expense categories (order matters for stacks) */
D.paymentLines = [
  {k:'b2bCost',      label:'B2B delivery cost',   c:'#0a9396'},
  {k:'rtdCost',      label:'RTD delivery cost',   c:'#57cc99'},
  {k:'payroll',      label:'Payroll',             c:'#d4a843'},
  {k:'professional', label:'Professional fees',   c:'#8b5cf6'},
  {k:'travel',       label:'Travel',              c:'#f59e0b'},
  {k:'software',     label:'Software & subs',     c:'#4ecdc4'},
  {k:'otherGA',      label:'Other G&A',           c:'#ef4444'},
  {k:'otherConsult', label:'Other consultancy',   c:'#94d2bd'},
  {k:'marketing',    label:'Marketing',           c:'#ec4899'},
  {k:'telephone',    label:'Telephone & net',     c:'#64748b'},
  {k:'courier',      label:'Courier',             c:'#475569'},
  {k:'print',        label:'Printing',            c:'#334155'},
  {k:'assets',       label:'Assets',              c:'#1d5c6e'},
  {k:'otherExp',     label:'Other',               c:'#7c3aed'}
];

/* ───────────────────  PIPELINE — PROBABILITY-WEIGHTED  ────────────────── */
/* [CF] 'B2B Rev' r101-103 / 'B2B Payments' r114-116 / 'RTD Rev' r41-43 /
   'RTD Payments' r48-50. Values already carry the stage probability
   (Highly 0.9 · Medium 0.6 · Low 0.3) applied at deal level.              */
D.pipe = {
  b2b: {
    rev: {
      high: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,639870,691635,445485,758235,554835,554835,232860],
      med:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,386226,396288,594288,677538,594288,594288,384624],
      low:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,142000,45600,0,142000,45600,0,0,0]
    },
    /* cost as modelled in the workbook (probability applied a second time) */
    cost: {
      high: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,258997.5,304863.75,194096.25,318633.75,243303.75,243303.75,136687.5],
      med:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,115867.8,118886.4,178286.4,203261.4,178286.4,178286.4,115387.2],
      low:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,31950,6840,0,31950,6840,0,0,0]
    }
  },
  rtd: {
    rev: {
      high: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,270000,0,180000,360000,0,0,0],
      med:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,647460,0,647460,0,0,0,0],
      low:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45000,323250,243000,494250,243000,243000,324000]
    },
    /* RTD pipeline costs are explicit deal-level amounts, not a % of revenue */
    cost: {
      high: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,180000,0,72000,0,0,0],
      med:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,817500,0,0,0,0],
      low:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,45000,0,45000,36000,0,0,0]
    }
  }
};
D.tierProb = {high:0.9, med:0.6, low:0.3};

/* B2B sales funnel — [CF] 'B2B Summary' r1-r7 (live snapshot: Oct-25 wave) */
D.funnel = [
  {stage:'Qualification',          prob:0.00, cycle:4, count:25},
  {stage:'Needs Analysis',         prob:0.20, cycle:4, count:2},
  {stage:'Value Proposition',      prob:0.40, cycle:3, count:1},
  {stage:'Proposal / Price Quote', prob:0.75, cycle:2, count:2},
  {stage:'Negotiation / Review',   prob:0.90, cycle:1, count:2},
  {stage:'Agreement to be signed', prob:0.90, cycle:1, count:1}
];

/* Deal-level pipeline register — [CF] 'B2B Rev' r63-89 / 'RTD Rev' r21-29 */
D.deals = {
  b2b:[
    ['A1 French Projection','Somika','high'],['A2 Projection','Somika','high'],
    ['B1 Projection','Somika','high'],['A1 Projection (120 learners)','Somika','high'],
    ['A2 Projection','Somika','high'],['B1 Projection','Somika','high'],
    ['Sales Training Programme (Online)','Jambo','high'],['Arabic A1.3','Mahindra','high'],
    ['French 1:1','MN Square','high'],['German','Nitin (B2C)','high'],
    ['First Payment (180 learners)','Tata','med'],['Final Payment','Tata','med'],
    ['Individual hour based — Assessments','Employed World','med'],
    ['Evaluation / Webinar sessions','Employed World','med'],
    ['Language programme','Sudarshan Chemicals','med'],
    ['German 1:1 Executive','Vinay Padroo (Radico Khaitan)','low'],
    ['Insurance (Online)','Mayfair','low'],['Indian Languages','Tata','low'],
    ['Portuguese (200 learners)','Noble Group','low'],['Lubumbashi — Eng/Fr/Swahili','Novotel','low'],
    ['DRC — Kinmarche','Zaki','low'],['LMS & LXP','Eastman Auto & Power','low']
  ],
  rtd:[
    ['Leo & Saggitarus — Euros, Austria','B2B — Taldo2','high'],
    ['Leo & Saggitarus — Euros, Germany','B2C','high'],
    ['2 Comms — Physiotherapist','GAC','high'],
    ['2 Comms — Dentist','GAC','high'],
    ['Invita','GAC','med'],
    ['2 Comms (B1 nurses) — Recruitment','Genrise','low'],
    ['Faro — Physiotherapist','Ana, A24','low'],
    ['Velocity','B2C','low'],
    ['Ampersand','B2C','low']
  ]
};

/* ─────────────────  PAYROLL BY DEPARTMENT (accrual basis)  ──────────────── */
/* Apr-25→Jun-26 [MIS] 'Manpower' r38-40 · Jul-26→Mar-27 rebuilt employee-by-
   employee from [CF] 'Payroll' (reconciles to the cashflow payroll line).   */
D.payrollDept = {
  ops: [277300,215300,212300,314800,295800,295800,293800,313800,272025,282820,268000,279161,251500,283000,298000, 285000,335000,335000,335000,335000,335000,0,335000,670000],
  ga:  [212000,240000,240000,240000,240000,240000,240000,240000,240000,270484,275000,275000,300000,254073,272000, 253635,369500,369500,369500,369500,369500,0,369500,672000],
  sm:  [0,64839,0,0,39667,125334,140000,140000,140000,140000,140000,140000,140000,129032,55000,             88717,138000,138000,138000,138000,138000,0,138000,276000]
};
D.headcount = [9,10,9,10,9,10,11,11,11,13,12,13,12,12,12];

/* ──────────────────────────  MIS  (accrual P&L)  ────────────────────────── */
/* [MIS] 'Income Statement (Books)' — Apr-25 → Jun-26 */
D.mis = {
  months:      D.months.slice(0,15),
  b2bRev:      [1642828.32,872266.38,424034.25,468186.85,500068.37,525911.46,571799.85,645264.18,838042.69,859859.14,825017.47,984688.05,1122246.49,945885.08,736002.21],
  rtdRev:      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  otherInc:    [0,0,0,0,0,0,0,0,0,0,0,0,3200,0,0],
  revenue:     [1642828.32,872266.38,424034.25,468186.85,500068.37,525911.46,571799.85,645264.18,838042.69,859859.14,825017.47,984688.05,1125446.49,945885.08,736002.21],
  rtdCogs:     [0,0,0,0,0,0,0,0,1800,26400,22000,44000,0,0,0],
  opsSalary:   [277300,215300,212300,314800,295800,295800,293800,313800,272025,282820,268000,279161,251500,283000,298000],
  teacherCost: [222318.67,228159.39,91892.84,154899.34,102201.75,115232.08,152142.3,182614.4,228480.48,285698.96,222588.82,260511.55,344594.85,245750,198550],
  cogs:        [499618.67,443459.39,304192.84,469699.34,398001.75,411032.08,445942.3,496414.4,502305.48,594918.96,512588.82,583672.55,596094.85,528750,496550],
  gp:          [1143209.66,428806.99,119841.41,-1512.49,102066.63,114879.38,125857.54,148849.78,335737.21,264940.18,312428.66,401015.5,529351.64,417135.08,239452.21],
  smMarketing: [0,0,0,0,0,0,0,20000,20000,20000,20000,20000,20000,0,0],
  smSoftware:  [0,55946.74,0,55946.74,15939.17,27784,35566.64,175897.48,21808.55,80056.65,53782,60522.01,25083.57,41199.71,55946.74],
  smSalary:    [0,64839,0,0,39667,125334,140000,140000,140000,140000,140000,140000,140000,129032,55000],
  smTravel:    [0,32782,0,32782,106790.05,138978,34815.88,66911.74,33583.83,74881.33,60495.02,29166,133125,38163.54,32782],
  smConsult:   [0,0,0,0,9999,0,0,107842.22,0,551976,103082,192533.2,0,0,0],
  sm:          [0,153567.74,0,88728.74,172395.22,292096,210382.52,510651.44,215392.38,866913.98,377359.02,442221.21,318208.57,208395.25,143728.74],
  gaRent:      [0,45072,0,45072,0,0,0,0,48879,48879,75273.84,57677.22,76902.96,45072,45072],
  gaMaint:     [0,0,0,0,1026,0,0,0,0,0,0,32203.4,0,0,0],
  gaSalary:    [212000,240000,240000,240000,240000,240000,240000,240000,240000,270484,275000,275000,300000,254072,272000],
  gaProf:      [0,69000,0,69000,138559,391504.79,246000,136000,205000,162440,217500,121700,144000,60000,69000],
  gaMisc:      [0,18998.28,0,18998.28,10151.22,80030.52,7792.49,14420.31,2524.54,2977.81,39381.65,32833.09,55254.84,83815.63,80519.3],
  ga:          [212000,373070.28,240000,373070.28,389736.22,711535.31,493792.49,390420.31,496403.54,484780.81,607155.49,519413.71,576157.8,442959.63,466591.3],
  ebitda:      [931209.66,-97831.03,-120158.59,-463311.51,-460064.81,-888751.93,-578317.47,-752221.97,-376058.71,-1086754.61,-672085.85,-560619.42,-365014.73,-234219.8,-370867.83]
};

/* Balance sheet — [MIS] 'Balance Sheet' cols O:Q (Apr-26 / May-26 / Jun-26) */
D.bs = {
  months: ['Apr-26','May-26','Jun-26'],
  liab: [
    ['Shareholder funds',        [100000,100000,100000]],
    ['Reserves & surplus',       [-7412991.56,-7871830.4,-8200172.23]],
    ['Short-term borrowing',     [361362,361362,361362]],
    ['Long-term borrowing (investor)',[10000000,10000000,15000000]],
    ['Duties & taxes',           [201724.74,234787.58,245137.58]],
    ['Accounts payable',         [1095662.78,851465.39,316830.43]],
    ['Other current liabilities',[211514.87,242791.07,207535.27]]
  ],
  liabTotal: [4557272.83,3918575.64,8030693.05],
  asset: [
    ['Fixed assets',             [35853,66653,66653]],
    ['Accounts receivable',      [1382303.91,1199378.46,928333.03]],
    ['Other current assets',     [1294341.34,1093487.55,1129459.84]],
    ['Cash & cash equivalents',  [1844774.58,1559056.63,5906247.18]]
  ],
  assetTotal: [4557272.83,3918575.64,8030693.05]
};

/* ────────────────────────  FY27 BUDGET (rebuilt)  ───────────────────────── */
/* [BUD] 'RTD Buildup' r21-23 · 'Pipeline Buildup FY27' r24-29 ·
   'Cost Buildup FY27' r12/r26/r35.  Apr-26 → Mar-27.                        */
D.budget = {
  months:    D.months.slice(12),
  rtdRev:    [887500,887500,887500,2750000,2750000,2750000,5500000,5500000,5500000,10000000,10000000,10000000],
  b2bGroup:  [749347,749347,749347,749347,749347,749347,749347,749347,749347,749347,749347,749347],
  b2bExist:  [629200,586000,586000,436000,396000,396000,0,0,0,0,0,0],
  b2bNew:    [0,36666.67,36666.67,73333.33,73333.33,146666.67,256666.67,366666.67,513333.33,660000,770000,916666.67],
  rtdCogs:   [724000,724000,724000,1328000,1328000,1328000,2536000,2536000,2536000,3260000,3260000,3260000],
  opsSalary: [281000,281000,281000,320000,320000,320000,320000,320000,320000,320000,320000,320000],
  sm:        [652000,946000,946000,1016000,1016000,1016000,1016000,1016000,1016000,1016000,1016000,1016000],
  ga:        [660000,760000,735000,710000,710000,710000,710000,710000,710000,710000,710000,710000],
  b2bCogsPct:0.60,
  /* buildup assumptions */
  rtdBuild: {
    nurses:      [5,5,5,10,10,10,20,20,20,25,25,25],
    revPerNurse: [177500,177500,177500,275000,275000,275000,275000,275000,275000,400000,400000,400000],
    batches:     [1,1,1,1,1,1,1,1,1,2,2,2],
    conversion:  0.80, b2cShare:0.50, b1Share:0.80,
    trainCost:120000, costB1:108500, costB2:170000
  },
  b2bBuild: {
    qualification:[100,150,180,200,200,200,200,200,200,200,200,200],
    clientsWon:   [0,1,0,1,0,2,3,3,4,4,3,4],
    stageConv:    [['Needs Analysis',0.10],['Value Proposition (Demo)',0.50],
                   ['Proposal / Price Quote',0.70],['Negotiation / Review',0.90],
                   ['Agreement to be signed',0.60]],
    avgStudents:10, avgStudentRev:22000, contractMonths:6
  },
  smLines: [['Marketing',50000],['Website & software',150000],['S&M manpower',441000],
            ['Travel',200000],['S&M consultants',150000],['Other S&M',25000]],
  gaLines: [['Office rent',80000],['G&A manpower',370000],['Professional charges',200000],
            ['Other G&A',60000]],
  salaryHeads: [['Management',2,110000],['Sr. Operations (Language Training)',1,125000],
                ['Operations',5,39000],['S&M',6,73500],['G&A',3,50000]]
};

/* Budget scenarios defined by the client in [BUD] 'Scenario' */
D.budgetScenarios = [['Scenario 1 — as per budget',1],['Scenario 2 — 75% of RTD target',0.75],
                     ['Scenario 3 — 50% of RTD target',0.50]];

/* CFO commentary as written in the June MIS pack — [MIS] 'CFO Commentory' */
D.juneCommentary = [
  ['Revenue','June-2026 revenue stands at ₹7.36L, down 22.2% month-on-month from ₹9.46L in May. The RTD revenue stream is yet to commence and remains the principal driver of the shortfall; the pipeline is intact with RTD revenue projected to begin from Aug-2026. Q1 FY26-27 revenue stands at ₹28.07L.'],
  ['Cost & Margins','Teacher costs for June are ₹1.99L, 19.2% below May\'s ₹2.46L, continuing the benefit of optimised teacher utilisation and reduced dependency on external consultants. Including operations salaries of ₹2.98L, total cost of sale for the month is ₹4.97L.'],
  ['Gross Profit','Gross Profit stands at ₹2.39L at a gross margin of 32.5%. Margin has compressed from 44.1% in May, as the lower B2B topline was absorbed by a largely fixed operations salary base of ₹2.98L. RTD continues to carry no associated cost.'],
  ['SG&A','Total SG&A for June is ₹6.10L, comprising S&M of ₹1.44L and G&A of ₹4.67L. S&M reduced by ₹0.65L month-on-month, while G&A rose ₹0.24L on higher professional fees and a one-off website development cost of ₹0.40L.'],
  ['EBITDA','EBITDA loss for June stands at ₹3.71L. Burn has widened from ₹2.34L in May, driven almost entirely by the ₹2.10L decline in revenue, as total costs were broadly flat month-on-month. Q1 FY26-27 EBITDA loss stands at ₹9.70L.']
];
