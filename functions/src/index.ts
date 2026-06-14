import { setGlobalOptions } from "firebase-functions/v2";

// Region per doc 07 §1. All callables are namespaced v1_*.
setGlobalOptions({ region: "me-west1" });

export { v1_ping } from "./ping.js";
export { v1_serveQuestion } from "./serve/serveQuestion.js";
export { v1_submitAnswer } from "./match/submitAnswer.js";
