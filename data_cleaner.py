#!/usr/bin/env python
"""
Clean COVID dashboard data and produce:

  public/data/state_week.csv  (state-level, 50 states × 126 weeks)
  public/data/nat_week.csv    (national aggregate, 1 row per week)

Inputs (from CSV_DIR):

  - COVID-19 Cases & Deaths by State.csv
  - COVID-19_Vaccinations by State.csv
  - co-est2024-alldata.csv
  - Vaccine Hesitancy for COVID-19.csv
"""

import os
from pathlib import Path

import numpy as np
import pandas as pd

# -------------------------------------------------------------------
# Paths and constants
# -------------------------------------------------------------------

CSV_DIR = os.environ.get("CSV_DIR", "CSV")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "public/data")

PATH_CASES = os.path.join(CSV_DIR, "COVID-19 Cases & Deaths by State.csv")
PATH_VAX   = os.path.join(CSV_DIR, "COVID-19_Vaccinations by State.csv")
PATH_HES   = os.path.join(CSV_DIR, "Vaccine Hesitancy for COVID-19.csv")
PATH_POP   = os.path.join(CSV_DIR, "co-est2024-alldata.csv")

START_DATE = pd.Timestamp("2020-12-16")  # first Wednesday
END_DATE   = pd.Timestamp("2023-05-10")  # last Wednesday

VALID_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
}

STATE_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
    "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    # Territories and DC intentionally omitted
}

# -------------------------------------------------------------------
# Utility
# -------------------------------------------------------------------

def ensure_output_dir():
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def wednesday_range():
    """All Wednesdays between START_DATE and END_DATE (inclusive)."""
    return pd.date_range(START_DATE, END_DATE, freq="W-WED")


# -------------------------------------------------------------------
# Population tables
# -------------------------------------------------------------------

def build_state_population_year(pop_file: str) -> pd.DataFrame:
    """
    From co-est2024-alldata.csv build:
      state_population_year[state_usps, year, population]

    Uses STNAME/CTYNAME where CTYNAME == STNAME for state rows.
    """
    pop = pd.read_csv(
        pop_file,
        encoding="latin1",
        usecols=[
            "STNAME", "CTYNAME",
            "POPESTIMATE2020", "POPESTIMATE2021",
            "POPESTIMATE2022", "POPESTIMATE2023",
        ],
    )

    # State rows have CTYNAME == STNAME
    state_rows = pop[pop["CTYNAME"] == pop["STNAME"]].copy()

    # Map to USPS, keep only 50 states
    state_rows["state_usps"] = state_rows["STNAME"].map(STATE_ABBR)
    state_rows = state_rows[state_rows["state_usps"].isin(VALID_STATES)].copy()

    # Melt yearly population
    melted = state_rows.melt(
        id_vars=["state_usps"],
        value_vars=[
            "POPESTIMATE2020", "POPESTIMATE2021",
            "POPESTIMATE2022", "POPESTIMATE2023",
        ],
        var_name="year_col",
        value_name="population",
    )

    melted["year"] = melted["year_col"].str.extract(r"(\d{4})").astype(int)
    melted["population"] = melted["population"].astype(int)

    state_population_year = melted[["state_usps", "year", "population"]].copy()

    return state_population_year


def build_us_population_year(state_population_year: pd.DataFrame) -> pd.DataFrame:
    """
    National population per year = sum of 50 states' populations.
    """
    us_pop = (
        state_population_year
        .groupby("year", as_index=False)["population"]
        .sum()
    )
    return us_pop  # columns: year, population


# -------------------------------------------------------------------
# Hesitancy (county-weighted into state)
# -------------------------------------------------------------------

def build_state_hesitancy(hes_file: str, pop_file: str) -> pd.DataFrame:
    """
    Returns DataFrame [state_usps, hesitancy_pct] where hesitancy_pct
    is 100 * population-weighted mean of 'Estimated hesitant or unsure'
    using 2021 county population.
    """
    hes = pd.read_csv(
        hes_file,
        usecols=["County Name", "State", "Estimated hesitant or unsure"],
    )

    hes = hes.rename(
        columns={
            "County Name": "county_raw",
            "State": "state_raw",
            "Estimated hesitant or unsure": "hes_prop",
        }
    )

    hes["state_name"] = hes["state_raw"].str.title()
    # "Tallapoosa County, Alabama" -> "Tallapoosa County"
    hes["county_label"] = hes["county_raw"].str.split(",").str[0].str.strip()

    hes["hes_prop"] = pd.to_numeric(hes["hes_prop"], errors="coerce")
    # If values are in 0–100 instead of 0–1, convert
    if hes["hes_prop"].max(skipna=True) > 1.0:
        hes["hes_prop"] = hes["hes_prop"] / 100.0

    # County populations for 2021
    pop = pd.read_csv(
        pop_file,
        encoding="latin1",
        usecols=["STNAME", "CTYNAME", "POPESTIMATE2021"],
    )
    county_pop = pop[pop["CTYNAME"] != pop["STNAME"]].copy()
    county_pop = county_pop.rename(
        columns={
            "STNAME": "state_name",
            "CTYNAME": "county_label",
            "POPESTIMATE2021": "pop_2021",
        }
    )

    merged = hes.merge(
        county_pop,
        how="inner",
        on=["state_name", "county_label"],
    )

    state_agg = (
        merged
        .groupby("state_name", as_index=False)
        .apply(lambda g: (g["hes_prop"] * g["pop_2021"]).sum() / g["pop_2021"].sum())
        .rename(columns={None: "hes_prop_state"})
    )

    state_agg["state_usps"] = state_agg["state_name"].map(STATE_ABBR)
    state_agg = state_agg[state_agg["state_usps"].isin(VALID_STATES)].copy()

    state_agg["hesitancy_pct"] = (state_agg["hes_prop_state"] * 100).round(2)

    return state_agg[["state_usps", "hesitancy_pct"]]


# -------------------------------------------------------------------
# Vaccination coverage by state-week
# -------------------------------------------------------------------

def build_vacc_state_week(vax_file: str) -> pd.DataFrame:
    """
    From COVID-19_Vaccinations by State.csv build:
      vacc_state_week[state_usps, week_end_date, vacc_pct_any_18p, vacc_pct_full_18p, booster_pct_18p]
    keeping only Wednesdays in the [START_DATE, END_DATE] range and only 50 states.
    """
    usecols = [
        "Date",
        "Location",
        "Administered_Dose1_Recip_18PlusPop_Pct",
        "Series_Complete_18PlusPop_Pct",
        "Additional_Doses_18Plus_Vax_Pct",
    ]
    vax = pd.read_csv(vax_file, usecols=usecols)

    vax["Date"] = pd.to_datetime(vax["Date"])
    vax = vax[(vax["Date"] >= START_DATE) & (vax["Date"] <= END_DATE)].copy()

    # Wednesdays only (weekday: Mon=0, Wed=2)
    vax = vax[vax["Date"].dt.weekday == 2].copy()

    vax["state_usps"] = vax["Location"].str.upper()
    vax = vax[vax["state_usps"].isin(VALID_STATES)].copy()

    vax["vacc_pct_any_18p"] = pd.to_numeric(
        vax["Administered_Dose1_Recip_18PlusPop_Pct"], errors="coerce"
    )
    vax["vacc_pct_full_18p"] = pd.to_numeric(
        vax["Series_Complete_18PlusPop_Pct"], errors="coerce"
    )
    vax["booster_pct_18p"] = pd.to_numeric(
        vax["Additional_Doses_18Plus_Vax_Pct"], errors="coerce"
    )

    out = vax[["state_usps", "Date", "vacc_pct_any_18p",
               "vacc_pct_full_18p", "booster_pct_18p"]].copy()
    out = out.rename(columns={"Date": "week_end_date"})

    # Ensure sorted and rounded
    out = out.sort_values(["state_usps", "week_end_date"])
    out[["vacc_pct_any_18p", "vacc_pct_full_18p", "booster_pct_18p"]] = (
        out[["vacc_pct_any_18p", "vacc_pct_full_18p", "booster_pct_18p"]].round(2)
    )

    return out


# -------------------------------------------------------------------
# Cases & deaths by state-week (weekly + cumulative per 100k)
# -------------------------------------------------------------------

def build_cases_state_week(cases_file: str,
                           state_population_year: pd.DataFrame) -> pd.DataFrame:
    """
    From COVID-19 Cases & Deaths by State.csv build:

      cases_state_week[
         state_usps, week_end_date, population,
         weekly_cases_per_100k, weekly_deaths_per_100k,
         cases_per_100k, deaths_per_100k,
         weekly_cases_count, weekly_deaths_count,
         tot_cases, tot_deaths
      ]

    Weekly metrics are based on the change in cumulative totals
    (tot_cases, tot_deaths), which automatically include historic
    backfills and corrections.
    """
    usecols = [
        "state", "end_date",
        "tot_cases", "new_cases",
        "tot_deaths", "new_deaths",
        "new_historic_cases", "new_historic_deaths",
    ]

    cases = pd.read_csv(
        cases_file,
        usecols=usecols,
        thousands=",",
    )

    cases["end_date"] = pd.to_datetime(cases["end_date"])

    # Filter time window
    mask = (cases["end_date"] >= START_DATE) & (cases["end_date"] <= END_DATE)
    cases = cases.loc[mask].copy()

    # Only the 50 states (drop DC, NYC, territories)
    cases["state_usps"] = cases["state"].str.upper()
    cases = cases[cases["state_usps"].isin(VALID_STATES)].copy()

    # Numeric conversions
    for col in ["tot_cases", "new_cases", "tot_deaths", "new_deaths",
                "new_historic_cases", "new_historic_deaths"]:
        if col in cases.columns:
            cases[col] = pd.to_numeric(cases[col], errors="coerce").fillna(0).astype(int)
        else:
            cases[col] = 0

    cases = cases.rename(columns={"end_date": "week_end_date"})

    # Join population by year
    cases["year"] = cases["week_end_date"].dt.year
    cases = cases.merge(
        state_population_year,
        how="left",
        left_on=["state_usps", "year"],
        right_on=["state_usps", "year"],
    )

    # Sort for diff-based weekly counts
    cases = cases.sort_values(["state_usps", "week_end_date"])

    # Weekly counts from change in cumulative totals
    cases["weekly_cases_count"] = (
        cases.groupby("state_usps")["tot_cases"]
        .diff()
        .fillna(cases["tot_cases"])
    )
    cases["weekly_deaths_count"] = (
        cases.groupby("state_usps")["tot_deaths"]
        .diff()
        .fillna(cases["tot_deaths"])
    )

    # Per 100k metrics
    pop = cases["population"].astype(float)
    cases["weekly_cases_per_100k"]  = (cases["weekly_cases_count"]  / pop * 1e5).round(2)
    cases["weekly_deaths_per_100k"] = (cases["weekly_deaths_count"] / pop * 1e5).round(2)
    cases["cases_per_100k"]         = (cases["tot_cases"]           / pop * 1e5).round(2)
    cases["deaths_per_100k"]        = (cases["tot_deaths"]          / pop * 1e5).round(2)

    out = cases[[
        "state_usps", "week_end_date", "population",
        "weekly_cases_per_100k", "weekly_deaths_per_100k",
        "cases_per_100k", "deaths_per_100k",
        "weekly_cases_count", "weekly_deaths_count",
        "tot_cases", "tot_deaths",
    ]].copy()

    return out


# -------------------------------------------------------------------
# Assemble state_week panel
# -------------------------------------------------------------------

def build_state_week(vax_state_week: pd.DataFrame,
                     cases_state_week: pd.DataFrame,
                     hes_state: pd.DataFrame) -> pd.DataFrame:
    """
    Combine vaccination, cases/deaths, and hesitancy into
    a full panel of 50 states × all Wednesdays.
    """
    weeks = wednesday_range()
    states = sorted(list(VALID_STATES))

    skeleton = pd.MultiIndex.from_product(
        [states, weeks],
        names=["state_usps", "week_end_date"]
    ).to_frame(index=False)

    out = skeleton.merge(
        vax_state_week,
        how="left",
        on=["state_usps", "week_end_date"],
    )
    out = out.merge(
        cases_state_week,
        how="left",
        on=["state_usps", "week_end_date"],
    )
    out = out.merge(
        hes_state,
        how="left",
        on="state_usps",
    )

    # Fill NaNs: missing vax -> 0, missing cases/deaths -> 0
    num_cols_zero = [
        "vacc_pct_any_18p", "vacc_pct_full_18p", "booster_pct_18p",
        "weekly_cases_per_100k", "weekly_deaths_per_100k",
        "cases_per_100k", "deaths_per_100k",
        "weekly_cases_count", "weekly_deaths_count",
        "tot_cases", "tot_deaths",
    ]
    for col in num_cols_zero:
        if col in out.columns:
            out[col] = out[col].fillna(0)

    # For population, carry the joined values (should not be NaN after merge)
    out["population"] = out["population"].fillna(method="ffill")

    # Hesitancy: just keep state-level baseline
    out["hesitancy_pct"] = out["hesitancy_pct"].round(2)

    out = out.sort_values(["state_usps", "week_end_date"])

    return out


# -------------------------------------------------------------------
# National weekly aggregates
# -------------------------------------------------------------------

def build_nat_week(state_week: pd.DataFrame,
                   us_population_year: pd.DataFrame,
                   hes_state: pd.DataFrame,
                   state_population_year: pd.DataFrame) -> pd.DataFrame:
    """
    Build nat_week with cumulative + weekly metrics for the US.
    """
    agg = (
        state_week
        .groupby("week_end_date", as_index=False)[["tot_cases", "tot_deaths"]]
        .sum()
    )

    # Attach national population by year
    agg["year"] = agg["week_end_date"].dt.year
    agg = agg.merge(
        us_population_year,
        how="left",
        on="year",
        suffixes=("", "_us"),
    ).rename(columns={"population": "population"})
    agg = agg.sort_values("week_end_date")

    pop = agg["population"].astype(float)

    # Weekly counts from change in national cumulative totals
    agg["weekly_cases_count"] = agg["tot_cases"].diff().fillna(agg["tot_cases"])
    agg["weekly_deaths_count"] = agg["tot_deaths"].diff().fillna(agg["tot_deaths"])

    # Per 100k metrics
    agg["weekly_cases_per_100k"]  = (agg["weekly_cases_count"]  / pop * 1e5).round(2)
    agg["weekly_deaths_per_100k"] = (agg["weekly_deaths_count"] / pop * 1e5).round(2)
    agg["cases_per_100k"]         = (agg["tot_cases"]           / pop * 1e5).round(2)
    agg["deaths_per_100k"]        = (agg["tot_deaths"]          / pop * 1e5).round(2)

    # Vaccination: population-weighted average across states
    vax_cols = ["vacc_pct_any_18p", "vacc_pct_full_18p", "booster_pct_18p"]
    vax_agg = (
        state_week
        .groupby("week_end_date")
        .apply(
            lambda g: pd.Series(
                {
                    col: (
                        (g[col].fillna(0) * g["population"]).sum() /
                        g["population"].sum()
                    )
                    for col in vax_cols
                }
            )
        )
        .reset_index()
    )
    vax_agg[vax_cols] = vax_agg[vax_cols].round(2)

    nat = agg.merge(vax_agg, how="left", on="week_end_date")

    # National hesitancy: 2021 population-weighted mean of states
    hes_merge = hes_state.merge(
        state_population_year[state_population_year["year"] == 2021],
        on="state_usps",
        how="left",
    )
    hes_prop = (
        (hes_merge["hesitancy_pct"] / 100 * hes_merge["population"]).sum()
        / hes_merge["population"].sum()
    )
    hes_pct_us = round(hes_prop * 100, 2)

    nat["state_usps"] = "US"
    nat["hesitancy_pct"] = hes_pct_us

    nat = nat[
        [
            "state_usps", "week_end_date",
            "vacc_pct_any_18p", "vacc_pct_full_18p", "booster_pct_18p",
            "weekly_cases_per_100k", "weekly_deaths_per_100k",
            "cases_per_100k", "deaths_per_100k",
            "weekly_cases_count", "weekly_deaths_count",
            "tot_cases", "tot_deaths",
            "hesitancy_pct", "population",
        ]
    ].copy()

    return nat.sort_values("week_end_date")


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

def main():
    ensure_output_dir()

    print("Loading population tables...")
    state_population_year = build_state_population_year(PATH_POP)
    us_population_year    = build_us_population_year(state_population_year)

    print("Building state hesitancy...")
    hes_state = build_state_hesitancy(PATH_HES, PATH_POP)

    print("Building vaccination panel...")
    vax_state_week = build_vacc_state_week(PATH_VAX)

    print("Building cases/deaths panel...")
    cases_state_week = build_cases_state_week(PATH_CASES, state_population_year)

    print("Assembling state_week panel...")
    state_week = build_state_week(vax_state_week, cases_state_week, hes_state)

    print("Building nat_week panel...")
    nat_week = build_nat_week(state_week, us_population_year,
                              hes_state, state_population_year)

    # Sanity check shapes: 50 states × 126 weeks
    n_weeks = state_week["week_end_date"].nunique()
    n_states = state_week["state_usps"].nunique()
    print(f"state_week: {state_week.shape[0]} rows ({n_states} states × {n_weeks} weeks)")
    print(f"nat_week:   {nat_week.shape[0]} rows (weeks)")

    # Write outputs
    state_path = os.path.join(OUTPUT_DIR, "state_week.csv")
    nat_path   = os.path.join(OUTPUT_DIR, "nat_week.csv")

    state_week.to_csv(state_path, index=False)
    nat_week.to_csv(nat_path, index=False)

    print(f"Wrote {state_path}")
    print(f"Wrote {nat_path}")
    print("Done.")


if __name__ == "__main__":
    main()
