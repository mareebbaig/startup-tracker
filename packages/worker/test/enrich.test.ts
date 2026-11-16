import { describe, expect, it } from "vitest";
import { computeMatch, findStack, isDevRole } from "@st/shared";
import { findBoardInHtml, findCareersLink, parseCareersHtml, parsePersonioXml } from "../src/enrich/ats.ts";
import { extractFounders } from "../src/enrich/founders.ts";
import { parseRobots } from "../src/enrich/http.ts";
import { hostScore, websiteFromArticleHtml } from "../src/enrich/website.ts";

describe("website from article", () => {
  const html = `<article>
    <a href="https://www.linkedin.com/company/langdock">LinkedIn</a>
    <a href="https://www.deutsche-startups.de/tag/ki">KI</a>
    <a href="https://www.generalcatalyst.com">General Catalyst</a>
    <a href="https://www.langdock.com/?utm=x">Langdock</a>
  </article>`;
  it("picks the company domain", () =>
    expect(websiteFromArticleHtml(html, "https://www.deutsche-startups.de/2026/11/10/langdock", "Langdock")).toBe("https://langdock.com"));
  it("ignores unrelated links", () =>
    expect(websiteFromArticleHtml(`<a href="https://foo.com">Foo</a>`, "https://x.de/a", "Langdock")).toBeNull());
  it("host scoring", () => {
    expect(hostScore("getcylib.com", "cylib")).toBe(0.9);
    expect(hostScore("agile-robots.com", "Agile Robots")).toBe(1);
    expect(hostScore("deepinvoice.ai", "deepinvoice")).toBe(1);
    expect(hostScore("google.com", "deepinvoice")).toBe(0);
  });
});

describe("job boards", () => {
  it.each([
    [`<a href="https://langdock.jobs.personio.de/">Jobs</a>`, "personio", "langdock"],
    [`<iframe src="https://boards.greenhouse.io/embed/job_board?for=agilerobots"></iframe>`, "greenhouse", "agilerobots"],
    [`<a href="https://job-boards.eu.greenhouse.io/sennder">x</a>`, "greenhouse", "sennder"],
    [`<a href="https://jobs.lever.co/opdo/123">x</a>`, "lever", "opdo"],
    [`<a href="https://jobs.ashbyhq.com/neuralsat">x</a>`, "ashby", "neuralsat"],
    [`<a href="https://join.com/companies/deepinvoice">x</a>`, "join", "deepinvoice"],
  ])("%s", (html, ats, slug) => {
    expect(findBoardInHtml(html)).toMatchObject({ ats, slug });
  });

  it("reads Personio XML", () => {
    const xml = `<?xml version="1.0"?><workzag-jobs>
      <position><id>111</id><office>Berlin</office><name>Senior Full-Stack Engineer (Node.js / React)</name>
        <jobDescriptions><jobDescription><name>Your tasks</name><value><![CDATA[<p>Build with TypeScript, MongoDB and AWS.</p>]]></value></jobDescription></jobDescriptions></position>
      <position><id>222</id><office>Berlin</office><name>Account Executive DACH</name></position>
    </workzag-jobs>`;
    const r = parsePersonioXml(xml, "langdock");
    expect(r.roles).toHaveLength(2);
    expect(r.roles[0]).toMatchObject({ isDev: true, url: "https://langdock.jobs.personio.de/job/111", location: "Berlin" });
    expect(r.roles[1].isDev).toBe(false);
    expect(findStack(r.text)).toEqual(expect.arrayContaining(["node", "react", "typescript", "mongodb", "aws"]));
  });

  it("reads job titles from a plain careers page", () => {
    const html = `<nav><a href="/jobs">Jobs</a></nav><main>
      <h2>Open positions</h2>
      <ul><li><a href="/jobs/backend">Backend Developer (m/w/d)</a></li>
          <li><a href="/jobs/sales">Sales Manager DACH</a></li>
          <li><a href="/jobs">View all jobs</a></li></ul></main>`;
    const r = parseCareersHtml(html, "https://xyz.de/karriere");
    expect(r.roles.map((x) => x.title)).toEqual(["Backend Developer (m/w/d)", "Sales Manager DACH"]);
    expect(r.roles[0]).toMatchObject({ isDev: true, url: "https://xyz.de/jobs/backend" });
  });

  it("finds the careers link", () => {
    expect(findCareersLink(`<a href="/de/karriere">Karriere</a>`, "https://xyz.de")).toBe("https://xyz.de/de/karriere");
    expect(findCareersLink(`<a href="https://xyz.de/about">About</a>`, "https://xyz.de")).toBeNull();
  });
});

describe("roles + stack + match", () => {
  it.each([
    ["Senior Full-Stack Engineer", true],
    ["Werkstudent Softwareentwicklung (m/w/d)", true],
    ["Machine Learning Engineer", true],
    ["Account Executive", false],
    ["Sales Engineer", false],
    ["Head of Marketing", false],
  ])("isDevRole(%s) = %s", (t, v) => expect(isDevRole(t)).toBe(v));

  it("java ≠ javascript, react ≠ react native", () => {
    expect(findStack("We use JavaScript")).not.toContain("java");
    expect(findStack("React Native app")).toEqual(["react-native"]);
  });

  it("score", () => {
    const roles = [{ title: "Full-Stack Engineer", isDev: true }];
    const m = computeMatch(roles, ["node", "react", "java"], new Date("2026-11-01"), new Date("2026-11-16"));
    expect(m).toEqual({ score: 40 + 24 + 14, stack: ["node", "react"], devRoles: 1, hiring: true });
    expect(computeMatch([], [], undefined).score).toBe(0);
  });
});

describe("founders", () => {
  it("German article", () => {
    const t = "Das Start-up wurde 2021 von Constantin Kauffmann, Tim Sippl und Yannik Mack gegründet. CTO Tim Sippl sagt …";
    const c = extractFounders("gegründet von Constantin Kauffmann, Tim Sippl und Yannik Mack. " + t, "https://a.de/x");
    expect(c.map((x) => x.name)).toEqual(expect.arrayContaining(["Constantin Kauffmann", "Tim Sippl", "Yannik Mack"]));
    expect(c.find((x) => x.name === "Tim Sippl")?.role).toBe("CTO");
  });
  it("English article", () => {
    const c = extractFounders("The startup was founded by Bastian Maiworm and Philipp Reißel in Aachen.", "https://a.com/x");
    expect(c.map((x) => x.name)).toEqual(["Bastian Maiworm", "Philipp Reißel"]);
  });
});

describe("robots.txt", () => {
  it("reads only User-agent: *", () => {
    const txt = "User-agent: Googlebot\nDisallow: /private\n\nUser-agent: *\nDisallow: /admin\nDisallow: /jobs/apply # forms\nAllow: /";
    expect(parseRobots(txt)).toEqual(["/admin", "/jobs/apply"]);
  });
});
