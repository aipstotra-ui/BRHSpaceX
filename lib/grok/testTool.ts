export const TEST_VALUE = {
  value: 42,
  unit: "count",
  label: "estimate" as const,
};

export const GET_TEST_VALUE_TOOL = {
  type: "function" as const,
  name: "get_test_value",
  description: "Return the fixed voice-test value.",
  parameters: {
    type: "object",
    properties: {},
  },
};

export function runGetTestValue(): string {
  return JSON.stringify({
    value: TEST_VALUE.value,
    label: TEST_VALUE.label,
  });
}
