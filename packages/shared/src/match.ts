import type { JobRole, Match } from "./types.ts";

/**
 * My profile — edit this to change what counts as a "match".
 * Keys = stack tag, values = regex that finds it in job text.
 */
export const MY_STACK = ["node", "typescript", "javascript", "react", "nextjs", "express", "mongodb", "python", "pytorch", "llm"];

/** Tech keywords we look for in job posts (stack tag → regex) */
export const STACK_KEYWORDS: Record<string, RegExp> = {
  node: /\bnode(\.?js)?\b/i,
  typescript: /\btypescript\b|\bts\b(?=[,/ ])/i,
  javascript: /\bjavascript\b|\becmascript\b/i,
  react: /\breact(\.?js)?\b(?! native)/i,
  "react-native": /\breact native\b/i,
  nextjs: /\bnext\.?js\b/i,
  vue: /\bvue(\.?js)?\b/i,
  angular: /\bangular\b/i,
  svelte: /\bsvelte\b/i,
  express: /\bexpress(\.js)?\b(?= |,|\/|\))/i,
  nestjs: /\bnest\.?js\b/i,
  graphql: /\bgraphql\b/i,
  mongodb: /\bmongo(db)?\b/i,
  postgres: /\bpostgres(ql)?\b/i,
  mysql: /\bmysql\b/i,
  redis: /\bredis\b/i,
  python: /\bpython\b/i,
  django: /\bdjango\b/i,
  fastapi: /\bfastapi\b/i,
  pytorch: /\bpytorch\b/i,
  tensorflow: /\btensorflow\b/i,
  llm: /\b(llms?|large language models?|langchain|rag|openai|genai)\b/i,
  java: /\bjava\b(?!script)/i,
  kotlin: /\bkotlin\b/i,
  go: /\bgolang\b|\bgo\b(?= ?(developer|engineer|backend|,|\/))/i,
  rust: /\brust\b/i,
  csharp: /\bc#|\.net\b/i,
  php: /\bphp\b|\blaravel\b/i,
  ruby: /\bruby\b|\brails\b/i,
  swift: /\bswift\b/i,
  flutter: /\bflutter\b|\bdart\b/i,
  aws: /\baws\b|\bamazon web services\b/i,
  gcp: /\bgcp\b|\bgoogle cloud\b/i,
  azure: /\bazure\b/i,
  docker: /\bdocker\b/i,
  kubernetes: /\bkubernetes\b|\bk8s\b/i,
  terraform: /\bterraform\b/i,
  fpga: /\bfpga\b|\bvhdl\b|\bverilog\b/i,
};

const DEV_ROLE =
  /\b(engineer|engineering|developer|entwickler(in)?|programmierer|software|full[- ]?stack|backend|back-end|frontend|front-end|devops|sre|data scien\w*|machine learning|\bml\b|\bai\b|ki-|architect|cto|tech lead)\b/i;

/** Roles that are clearly not hands-on dev work */
const NOT_DEV = /\b(sales|vertrieb|account (executive|manager)|recruit\w*|marketing|hr\b|people|office|finance|buchhaltung|customer success)\b/i;

/** German compounds: "Softwareentwicklung", "Backendentwickler", "KI-Entwicklerin" */
const DEV_COMPOUND = /softwareentwickl|entwickler|softwarearchitekt|datenwissenschaft/i;

export function isDevRole(title: string): boolean {
  return (DEV_ROLE.test(title) || DEV_COMPOUND.test(title)) && !NOT_DEV.test(title);
}

export function findStack(text: string): string[] {
  return Object.entries(STACK_KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([tag]) => tag);
}

/**
 * Score 0..100:
 *  - hiring devs: +40 (any dev role), +10 more if 3+
 *  - stack overlap with MY_STACK: +12 each, max 36
 *  - recent round (≤ 90 days): +14
 */
export function computeMatch(roles: JobRole[], stack: string[], lastRoundAt?: Date, now = new Date()): Match {
  const devRoles = roles.filter((r) => r.isDev).length;
  const myStack = stack.filter((s) => MY_STACK.includes(s));
  let score = 0;
  if (devRoles > 0) score += 40;
  if (devRoles >= 3) score += 10;
  score += Math.min(myStack.length * 12, 36);
  if (lastRoundAt && now.getTime() - lastRoundAt.getTime() <= 90 * 86_400_000) score += 14;
  return { score: Math.min(score, 100), stack: myStack, devRoles, hiring: roles.length > 0 };
}
