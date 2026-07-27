const usStateAbbreviations: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

const usCountryNames = new Set(["united states", "united states of america", "usa", "us"]);

export function formatCompactLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    return location.trim();
  }

  const country = parts.at(-1) ?? "";
  const isUnitedStates = usCountryNames.has(country.toLowerCase());

  if (isUnitedStates && parts.length >= 3) {
    const statePart = stripPostalCode(parts.at(-2) ?? "");
    const state = usStateAbbreviations[statePart.toLowerCase()] ?? statePart;
    const city = parts.at(-3) ?? parts[0];
    return `${city}, ${state}`;
  }

  const finalPartWithoutPostalCode = stripPostalCode(country);
  const state = usStateAbbreviations[finalPartWithoutPostalCode.toLowerCase()];

  if (state) {
    return `${parts.at(-2)}, ${state}`;
  }

  if (parts.length >= 3) {
    const locality = parts.length === 3 ? parts[0] : parts.at(-3);
    return `${locality}, ${country}`;
  }

  return parts.join(", ");
}

function stripPostalCode(value: string) {
  return value.replace(/\s+\d{5}(?:-\d{4})?$/, "").trim();
}
