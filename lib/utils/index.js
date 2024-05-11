"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuid = void 0;
const KSUID = require("ksuid");
const uuid = () => {
    return KSUID.randomSync().string;
};
exports.uuid = uuid;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBZ0M7QUFDekIsTUFBTSxJQUFJLEdBQUcsR0FBVyxFQUFFO0lBQy9CLE9BQU8sS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLE1BQU0sQ0FBQztBQUNuQyxDQUFDLENBQUM7QUFGVyxRQUFBLElBQUksUUFFZiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBLU1VJRCA9IHJlcXVpcmUoXCJrc3VpZFwiKTtcbmV4cG9ydCBjb25zdCB1dWlkID0gKCk6IHN0cmluZyA9PiB7XG4gIHJldHVybiBLU1VJRC5yYW5kb21TeW5jKCkuc3RyaW5nO1xufTtcbiJdfQ==