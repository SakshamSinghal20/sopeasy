export function definitiveResolution(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const answer = value.trim();
  const conditional = answer.match(
    /^(?:if|when|unless)\b[\s\S]+?(?:,|;|\bthen\b)\s*([\s\S]+)$/i,
  );
  const policyUnknown =
    conditional &&
    /\b(?:verifies?|checks?|reviews?|approves?|records?|confirms?|contacts?|completes?|must|shall)\b/i.test(
      conditional[1],
    );
  const uncertainty = policyUnknown
    ? answer
        .slice(0, answer.length - conditional[1].length)
        .replace(/\bunknown\b/gi, "unavailable") + conditional[1]
    : answer;
  if (
    /\b(?:TBD|TODO|unknown|unsure|maybe|not (?:yet )?(?:sure|decided|specified)|to be (?:decided|confirmed))\b/i.test(
      uncertainty,
    )
  )
    return false;
  return !/^(?:(?:this|it|that|(?:the )?(?:issue|question|gap|answer))\s+(?:is|was|has been|will be|must be|should be|would be|can be|needs? to be)\s+)?(?:ok(?:ay)?|yes|no|done|confirmed|resolved|fixed|fine|good|n\/?a|not applicable|either|both)(?:\s+(?:now|already))?[.!\s]*$/i.test(
    answer,
  );
}
