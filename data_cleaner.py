# etl.py
# Denormalize to a single state × week fact table + national series + cleaned event markers

import os
import sys
import warnings
import pandas as pd
import numpy as np
from datetime import datetime
from dateutil import parser as dateparser

# Suppress FutureWarning about DataFrame concat (deprecation notice, functionality still works)
warnings.filterwarnings('ignore', category=FutureWarning, message='.*DataFrame concatenation.*')

# =========================
# EDIT THESE PATHS FIRST
# =========================
CSV_DIR = "original_data"  # e.g., "/Users/Teammate/Desktop/Project/CSV"
OUTPUT_DIR = "data"  # e.g., "/Users/Teammate/Desktop/Project/ETL_OUT"

PATH_CASES = os.path.join(CSV_DIR, "COVID-19 Cases & Deaths by State.csv")
PATH_VAX   = os.path.join(CSV_DIR, "COVID-19_Vaccinations by State.csv")
PATH_HES   = os.path.join(CSV_DIR, "Vaccine Hesitancy for COVID-19.csv")
PATH_POP   = os.path.join(CSV_DIR, "per 100k normalization.csv")
PATH_EVENTS= os.path.join(CSV_DIR, "COVID19_Vaccine_Event_Markers.csv")

OUT_FACT   = os.path.join(OUTPUT_DIR, "state_week_fact.csv")
OUT_NAT    = os.path.join(OUTPUT_DIR, "national_week_timeseries.csv")
OUT_EVENTS = os.path.join(OUTPUT_DIR, "vaccine_event_markers_clean.csv")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# =========================
# Helpers
# =========================

# USPS ↔ FIPS mapping (50 states + DC)
STATE_TO_FIPS = {
    'AL': '01','AK': '02','AZ': '04','AR': '05','CA': '06','CO': '08','CT': '09','DE': '10','DC': '11',
    'FL': '12','GA': '13','HI': '15','ID': '16','IL': '17','IN': '18','IA': '19','KS': '20','KY': '21',
    'LA': '22','ME': '23','MD': '24','MA': '25','MI': '26','MN': '27','MS': '28','MO': '29','MT': '30',
    'NE': '31','NV': '32','NH': '33','NJ': '34','NM': '35','NY': '36','NC': '37','ND': '38','OH': '39',
    'OK': '40','OR': '41','PA': '42','RI': '44','SC': '45','SD': '46','TN': '47','TX': '48','UT': '49',
    'VT': '50','VA': '51','WA': '53','WV': '54','WI': '55','WY': '56'
}
FIPS_TO_STATE = {v: k for k, v in STATE_TO_FIPS.items()}

def to_iso_date(x):
    if pd.isna(x) or str(x).strip() == "":
        return np.nan
    # handle already-ISO strings
    try:
        dt = dateparser.parse(str(x), dayfirst=False, yearfirst=False)
        return dt.date().isoformat()
    except Exception:
        return np.nan

def clean_numeric(s):
    """Remove commas/percent signs/spaces; return float"""
    if pd.isna(s):
        return np.nan
    t = str(s).replace(',', '').replace('%', '').strip()
    if t == '':
        return np.nan
    try:
        return float(t)
    except Exception:
        return np.nan

def find_column(df, candidates, required=True, description=""):
    """
    Find a column in a DataFrame by trying multiple candidate names (case-insensitive).
    
    Args:
        df: DataFrame to search
        candidates: List of possible column names (will try case-insensitive matches)
        required: If True, raise error if not found; if False, return None
        description: Description for error message
    
    Returns:
        Column name if found, None if not found and not required
    """
    # First try exact matches (case-sensitive)
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    
    # Then try case-insensitive matches
    df_cols_lower = {col.lower(): col for col in df.columns}
    for candidate in candidates:
        if candidate.lower() in df_cols_lower:
            return df_cols_lower[candidate.lower()]
    
    # Try with stripped whitespace
    df_cols_stripped = {col.strip(): col for col in df.columns}
    for candidate in candidates:
        if candidate.strip() in df_cols_stripped:
            return df_cols_stripped[candidate.strip()]
    
    if required:
        error_msg = f"Could not find required column. Tried: {candidates}"
        if description:
            error_msg += f" ({description})"
        error_msg += f"\nAvailable columns: {list(df.columns)}"
        raise ValueError(error_msg)
    
    return None

def left_join_nearest_week(df_left, df_right, on_keys, left_date_col, right_date_col, max_gap_days=3):
    """
    Join right onto left on (on_keys + nearest date within ±max_gap_days).
    Assumes date cols are datetime64[ns]. Returns df_left with matched columns from right (suffixed).
    """
    # cartesian within key groups not ideal; we do a smart merge:
    out = []
    r = df_right.copy()
    r = r.set_index(on_keys + [right_date_col]).sort_index()

    for gkeys, grp in df_left.groupby(on_keys, dropna=False):
        if not isinstance(gkeys, tuple):
            gkeys = (gkeys,)
        try:
            r_sub = r.xs(gkeys, level=on_keys, drop_level=False)
        except KeyError:
            # no matching key group
            r_sub = pd.DataFrame(columns=r.columns)

        if r_sub.empty:
            # no matches, just append with NaNs
            out.append(grp.assign(_match_idx=pd.NA))
            continue

        # For each left row, pick the right row nearest in time within window
        r_sub = r_sub.reset_index()
        r_sub = r_sub[[*on_keys, right_date_col] + [c for c in r_sub.columns if c not in on_keys + [right_date_col]]]

        def pick_nearest(ts):
            deltas = (r_sub[right_date_col] - ts).abs()
            idx = deltas.idxmin()
            days = deltas.iloc[idx].days
            if days <= max_gap_days:
                return idx
            return None

        idxs = grp[left_date_col].apply(pick_nearest)
        joined = grp.copy()
        joined["_match_idx"] = idxs.values
        out.append(joined)

    # Filter out empty DataFrames before concat to avoid FutureWarning
    out_filtered = [df for df in out if not df.empty]
    if not out_filtered:
        return df_left.copy()
    L = pd.concat(out_filtered, ignore_index=True)
    # Now attach right columns by index
    r_reset = r.reset_index().reset_index().rename(columns={"index": "_match_idx"})
    merged = L.merge(r_reset, on="_match_idx", how="left", suffixes=("", "_r"))
    merged.drop(columns=["_match_idx"], inplace=True)
    return merged

# =========================
# 1) Load & clean Population
# =========================
# The population CSV has a special structure:
# Row 1: Headers ("Geographic Area", "April 1, 2020 Estimates Base", "Population Estimate (as of July 1)", ...)
# Row 2: Year headers (empty, empty, 2020, 2021, 2022, 2023, 2024, ...)
# Rows 3+: Data with state names in first column and population values in year columns
pop_raw = pd.read_csv(PATH_POP, header=None, dtype=str)

# Find the Geographic Area column (first column, index 0)
geo_col_idx = 0

# Find year columns in row 1 (index 1)
year_row = pop_raw.iloc[1]
year_col_indices = {}
for idx, val in enumerate(year_row):
    val_str = str(val).strip()
    if val_str.isdigit() and len(val_str) == 4:
        year_col_indices[val_str] = idx

if not year_col_indices:
    raise ValueError("Could not find year columns in population CSV")

# Use 2020 as baseline population year (or first available year)
pop_year = "2020" if "2020" in year_col_indices else list(year_col_indices.keys())[0]
pop_col_idx = year_col_indices[pop_year]

# Extract data starting from row 2 (index 2)
pop_data = []
for idx in range(2, len(pop_raw)):
    state_name = str(pop_raw.iloc[idx, geo_col_idx]).strip()
    pop_value = str(pop_raw.iloc[idx, pop_col_idx]).strip()
    
    # Skip empty rows or metadata rows
    if not state_name or state_name == "nan" or state_name.startswith("The Census") or state_name.startswith("Note:") or state_name.startswith("Suggested") or state_name.startswith("Source:") or state_name.startswith("Release"):
        continue
    
    pop_data.append({
        "state_name": state_name,
        "population": clean_numeric(pop_value)
    })

pop = pd.DataFrame(pop_data)
pop["population"] = pop["population"].astype("Int64")

# Strip dots from state names
pop["state_name"] = pop["state_name"].str.replace(r"^\.", "", regex=True)

# Map state names to USPS codes
NAME_TO_USPS = {
    'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT',
    'Delaware':'DE','District of Columbia':'DC','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL',
    'Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
    'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV',
    'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',
    'Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
    'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV',
    'Wisconsin':'WI','Wyoming':'WY'
}

pop["state_usps"] = pop["state_name"].map(NAME_TO_USPS)

# Filter out non-state rows (regions, territories, empty rows)
pop = pop[pop["state_usps"].notna()].copy()
pop = pop[["state_usps", "population"]].dropna()
pop["state_fips"] = pop["state_usps"].map(STATE_TO_FIPS)

missing_fips = pop[pop["state_fips"].isna()]
if not missing_fips.empty:
    print("WARNING: Population has unknown USPS codes:\n", missing_fips)

# =========================
# 2) Load & clean Hesitancy (county → state)
# =========================
hes = pd.read_csv(PATH_HES, dtype=str).rename(columns=lambda c: c.strip())

# Find state column (could be "State", "state", "State Code", etc.)
state_col = find_column(hes, ["State", "state", "State Code", "state_code", "USPS", "usps", "Location", "location"], 
                       description="state identifier")
hesitant_col = find_column(hes, ["Estimated hesitant", "estimated hesitant", "Estimated_hesitant", "hesitancy", "Hesitancy"],
                          description="hesitancy percentage")

# Convert state names to USPS codes
# First, try to see if it's already a USPS code (2 letters)
state_values = hes[state_col].str.strip().str.upper()
# Check if values are already USPS codes (2 letters) or full state names
is_usps = state_values.str.len() == 2

# Map full state names to USPS codes
NAME_TO_USPS = {
    'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA','COLORADO':'CO','CONNECTICUT':'CT',
    'DELAWARE':'DE','DISTRICT OF COLUMBIA':'DC','FLORIDA':'FL','GEORGIA':'GA','HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL',
    'INDIANA':'IN','IOWA':'IA','KANSAS':'KS','KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD','MASSACHUSETTS':'MA',
    'MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO','MONTANA':'MT','NEBRASKA':'NE','NEVADA':'NV',
    'NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY','NORTH CAROLINA':'NC','NORTH DAKOTA':'ND',
    'OHIO':'OH','OKLAHOMA':'OK','OREGON':'OR','PENNSYLVANIA':'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD',
    'TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT','VERMONT':'VT','VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV',
    'WISCONSIN':'WI','WYOMING':'WY'
}

# Convert to USPS codes
hes["state_usps"] = state_values.where(is_usps, state_values.map(NAME_TO_USPS))
hes["Estimated hesitant"] = hes[hesitant_col].apply(clean_numeric)

# Filter out rows where we couldn't map to a USPS code
hes = hes[hes["state_usps"].notna()].copy()

hes_state = (
    hes.groupby("state_usps", as_index=False)["Estimated hesitant"]
       .mean(numeric_only=True)
       .rename(columns={"Estimated hesitant": "hesitancy_pct"})
)
# attach fips for later
hes_state["state_fips"] = hes_state["state_usps"].map(STATE_TO_FIPS)

# =========================
# 3) Load & clean Cases/Deaths (weekly)
# =========================
cases = pd.read_csv(PATH_CASES, dtype=str).rename(columns=lambda c: c.strip())

# Find required columns with flexible matching
state_col = find_column(cases, ["state", "State", "STATE", "state_code", "State Code", "Location", "location"],
                       description="state identifier")
end_date_col = find_column(cases, ["end_date", "end date", "End Date", "END_DATE", "week_end_date", "Week End Date"],
                         description="end date")
new_cases_col = find_column(cases, ["new_cases", "new cases", "New Cases", "NEW_CASES", "cases", "Cases"],
                           description="new cases")
new_deaths_col = find_column(cases, ["new_deaths", "new deaths", "New Deaths", "NEW_DEATHS", "deaths", "Deaths"],
                            description="new deaths")

# Normalize
cases["state_usps"] = cases[state_col].str.strip().str.upper()
cases["week_end_date"] = cases[end_date_col].apply(to_iso_date)
cases["new_cases"]  = cases[new_cases_col].apply(clean_numeric).astype("Int64")
cases["new_deaths"] = cases[new_deaths_col].apply(clean_numeric).astype("Int64")

cases = cases[["state_usps","week_end_date","new_cases","new_deaths"]].dropna(subset=["state_usps","week_end_date"])

# add fips + population + rates
cases = cases.merge(pop, on="state_usps", how="left")
cases["state_fips"] = cases["state_usps"].map(STATE_TO_FIPS)

if cases["population"].isna().any():
    missing = cases[cases["population"].isna()]["state_usps"].unique().tolist()
    print("WARNING: Missing population for states:", missing)

cases["cases_per_100k"]  = (cases["new_cases"].astype(float)  / cases["population"].astype(float)) * 100000
cases["deaths_per_100k"] = (cases["new_deaths"].astype(float) / cases["population"].astype(float)) * 100000

# Convert date to datetime for later nearest-week join
cases["week_end_dt"] = pd.to_datetime(cases["week_end_date"], errors="coerce")

# =========================
# 4) Load & clean Vaccinations (weekly)
# =========================
vax = pd.read_csv(PATH_VAX, dtype=str).rename(columns=lambda c: c.strip())

# Find location/state column
location_col = find_column(vax, ["Location", "location", "State", "state", "STATE", "state_code", "State Code"],
                          description="state/location identifier")
date_col = find_column(vax, ["Date", "date", "DATE", "week_end_date", "Week End Date", "end_date"],
                      description="date")

# Pull key pct fields (try multiple variations)
col_any = find_column(vax, [
    "Administered_Dose1_Recip_18PlusPop_Pct",
    "Administered Dose1 Recip 18PlusPop Pct"
], description="vaccination percentage (any dose)")

col_full = find_column(vax, [
    "Series_Complete_18PlusPop_Pct",
    "Series Complete 18PlusPop Pct"
], description="vaccination percentage (fully vaccinated)")

col_boost = find_column(vax, [
    "Additional_Doses_18Plus_Vax_Pct",
    "Additional Doses 18Plus Vax Pct",
    "Booster_18Plus_Pct",
    "Booster 18Plus Pct"
], required=False, description="booster percentage")

# If booster column not found, create it as NaN
if col_boost is None:
    col_boost = "Additional_Doses_18Plus_Vax_Pct"
    vax[col_boost] = np.nan

vax_clean = vax[[location_col, date_col, col_any, col_full, col_boost]].copy()
# Rename to normalized names for easier access
vax_clean.rename(columns={
    location_col: "Location",
    date_col: "Date",
    col_any: "_col_any",
    col_full: "_col_full",
    col_boost: "_col_boost"
}, inplace=True)

vax_clean["state_usps"] = vax_clean["Location"].str.strip().str.upper()
vax_clean["week_end_date_vax"] = vax_clean["Date"].apply(to_iso_date)

vax_clean["vacc_pct_any_18p"]  = vax_clean["_col_any"].apply(clean_numeric)
vax_clean["vacc_pct_full_18p"] = vax_clean["_col_full"].apply(clean_numeric)
vax_clean["booster_pct_18p"]   = vax_clean["_col_boost"].apply(clean_numeric)

vax_clean = vax_clean[["state_usps","week_end_date_vax","vacc_pct_any_18p","vacc_pct_full_18p","booster_pct_18p"]].dropna(subset=["state_usps","week_end_date_vax"])
vax_clean["week_end_dt_vax"] = pd.to_datetime(vax_clean["week_end_date_vax"], errors="coerce")

# =========================
# 5) Join Cases (left) ⟵ nearest-week Vaccinations (right)
# =========================
left = cases.copy()
right = vax_clean.copy()

left.rename(columns={"week_end_dt":"_left_dt"}, inplace=True)
right.rename(columns={"week_end_dt_vax":"_right_dt"}, inplace=True)

joined = left_join_nearest_week(
    df_left=left,
    df_right=right,
    on_keys=["state_usps"],
    left_date_col="_left_dt",
    right_date_col="_right_dt",
    max_gap_days=3
)

# Keep one date (from cases) as canonical week_end_date
keep_cols = [
    "state_usps","state_fips","population","week_end_date",
    "cases_per_100k","deaths_per_100k",
    "vacc_pct_any_18p","vacc_pct_full_18p","booster_pct_18p"
]
fact = joined[keep_cols].copy()

# =========================
# 6) Attach Hesitancy (state-level, static)
# =========================
fact = fact.merge(hes_state[["state_usps","hesitancy_pct"]], on="state_usps", how="left")

# =========================
# 7) Final ordering, dtypes, and sanity checks
# =========================
fact = fact.sort_values(["state_usps","week_end_date"]).reset_index(drop=True)
# Remove any impossible values
for pct_col in ["vacc_pct_any_18p","vacc_pct_full_18p","booster_pct_18p","hesitancy_pct"]:
    if pct_col in fact.columns:
        fact.loc[(fact[pct_col] < 0) | (fact[pct_col] > 100), pct_col] = np.nan

# Select final column order
fact = fact[[
    "state_fips","state_usps","week_end_date",
    "vacc_pct_full_18p","vacc_pct_any_18p","booster_pct_18p",
    "cases_per_100k","deaths_per_100k",
    "hesitancy_pct",
    "population"
]]

# =========================
# 8) National weekly timeseries (population-weighted)
# =========================
def pop_weighted_avg(group, num_col):
    # weights = population; ignore NaNs
    v = group[num_col].astype(float)
    w = group["population"].astype(float)
    mask = (~v.isna()) & (~w.isna())
    if mask.sum() == 0:
        return np.nan
    return np.average(v[mask], weights=w[mask])

nat = (
    fact.groupby("week_end_date", as_index=False)
        .agg(vacc_pct_full_18p = ("vacc_pct_full_18p", lambda s: pop_weighted_avg(fact.loc[s.index], "vacc_pct_full_18p")),
             cases_per_100k     = ("cases_per_100k",     lambda s: pop_weighted_avg(fact.loc[s.index], "cases_per_100k")),
             deaths_per_100k    = ("deaths_per_100k",    lambda s: pop_weighted_avg(fact.loc[s.index], "deaths_per_100k")))
        .sort_values("week_end_date")
)

# =========================
# 9) Clean Event Markers (pass through, normalize date)
# =========================
events = pd.read_csv(PATH_EVENTS, dtype=str).rename(columns=lambda c: c.strip())

# Find event columns with flexible matching
date_col = find_column(events, ["Date", "date", "DATE", "event_date", "Event Date"],
                      description="event date")
event_col = find_column(events, ["Event", "event", "EVENT", "event_name", "Event Name"],
                       description="event description")
source_col = find_column(events, ["Source", "source", "SOURCE", "source_name"],
                        required=False, description="event source")
url_col = find_column(events, ["Official_Source_URL", "Official Source URL", "official_source_url", 
                               "Source_URL", "Source URL", "URL", "url"],
                     required=False, description="source URL")

events_out = pd.DataFrame({
    "date": events[date_col].apply(to_iso_date),
    "event": events[event_col],
    "source": events[source_col] if source_col else "",
    "official_source_url": events[url_col] if url_col else ""
})

# =========================
# 10) Write outputs
# =========================
fact.to_csv(OUT_FACT, index=False)
nat.to_csv(OUT_NAT, index=False)
events_out.to_csv(OUT_EVENTS, index=False)

# =========================
# 11) Console summary
# =========================
print("\n=== ETL COMPLETE ===")
print(f"state_week_fact.csv rows: {len(fact):,}  → {OUT_FACT}")
print(f"national_week_timeseries.csv rows: {len(nat):,}  → {OUT_NAT}")
print(f"vaccine_event_markers_clean.csv rows: {len(events_out):,} → {OUT_EVENTS}")

print("\nSample state_week_fact:")
print(fact.head(8).to_string(index=False))

# Coverage quick check
total_weeks_states = fact[["state_usps","week_end_date"]].drop_duplicates().shape[0]
missing_vax = fact["vacc_pct_full_18p"].isna().mean()
missing_cases = fact["cases_per_100k"].isna().mean()
print("\nCoverage:")
print(f"Unique (state, week) combos: {total_weeks_states:,}")
print(f"% rows missing vacc_pct_full_18p: {missing_vax:.1%}")
print(f"% rows missing cases_per_100k:    {missing_cases:.1%}")

