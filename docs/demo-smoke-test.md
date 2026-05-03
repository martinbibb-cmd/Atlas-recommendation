# Atlas Demo Journey — Smoke-Test Checklist

Use this checklist before any pitch or demo session to confirm the demo workspace is
in a clean, pitch-ready state.

---

## 1. Load demo workspace

- [ ] Open the Developer Menu: append `?devmenu=1` to the app URL
- [ ] Click **🎬 Load demo workspace** and confirm the dialog
- [ ] Confirm navigation lands on the **Workspace Dashboard**
- [ ] Confirm the amber banner **"🎬 Demo workspace active — Demo Heating Co"** is visible

---

## 2. Dashboard banner quick links

Run each quick link from the demo banner:

- [ ] **📋 Open sample visit** → Visit Hub opens for `demo_visit_001`
  - Status shows as completed / won
- [ ] **📊 View analytics** → Analytics Dashboard opens
  - KPI tiles populated (visits created: 5, completed: 3)
  - Close rate: 50 % (1 won · 1 lost)
- [ ] **📎 View external files** → External Visit Manifest panel opens for `demo_visit_001`
  - Three file references visible: *Boiler photo (front)*, *Loft scan capture*, *Atlas recommendation report*
- [ ] **🎯 View customer pack** → Customer Advice Print Pack / Presentation opens with engine data

---

## 3. Visit Hub (demo_visit_001)

Open the sample visit from the dashboard banner, then verify:

- [ ] Visit header shows the visit as completed / won
- [ ] **Open Presentation** button → `CanonicalPresentationPage` renders without errors
- [ ] **Print summary** button → `CustomerAdvicePrintPack` renders in print layout
- [ ] **External Files** button → Manifest panel shows 3 file references
- [ ] **Insight Pack** / deck (if applicable) renders the 11-screen recommendation deck

---

## 4. Analytics Dashboard

Navigate to `/analytics` or use the **📊 View analytics** quick link:

- [ ] Tenant column shows `demo-heating`
- [ ] Visits created: **5**
- [ ] Visits completed: **3**
- [ ] Won jobs: **1**, Lost jobs: **1**, Follow-up: **1**
- [ ] Close rate: **50 %**

---

## 5. Reset — restore clean demo state

After any exploratory session, restore the canonical demo state:

- [ ] Open `?devmenu=1` → click **🎬 Load demo workspace** → confirm
- [ ] Confirm redirect to Workspace Dashboard
- [ ] Confirm analytics counts match the canonical values in section 4 above

---

## Demo visit reference

| Visit ID             | Scenario             | Outcome        |
|----------------------|----------------------|----------------|
| `demo_visit_001`     | Combi replacement    | Won            |
| `demo_visit_002`     | ASHP upgrade         | Lost           |
| `demo_visit_003`     | Combi replacement    | Follow-up      |
| `demo_visit_004`     | —                    | Abandoned      |
| `demo_visit_005`     | —                    | In progress    |

External file manifest is attached to **`demo_visit_001`** only.
