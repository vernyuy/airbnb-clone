import KSUID = require("ksuid");
export const uuid = (): string => {
  return KSUID.randomSync().string;
};
