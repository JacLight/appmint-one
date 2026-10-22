import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function StowboCookies() {
  return (
    <>
      <SiteHeader />

      <section className="pagehead"><div className="wrap">
        <p className="eyebrow">Legal</p>
        <h1>Cookie Policy</h1>
        <p className="sub">How Stowbo uses cookies and similar technologies, the categories we rely on, and how you can control them.</p>
        <p className="updated">Last updated August 18, 2026</p>
      </div></section>

      <div className="wrap"><div className="legal">
        <aside className="toc">
          <h5>On this page</h5>
          <a href="#what">What cookies are</a>
          <a href="#categories">Categories we use</a>
          <a href="#third-party">Third-party cookies</a>
          <a href="#managing">Managing cookies</a>
          <a href="#dnt">Do Not Track</a>
          <a href="#updates">Updates &amp; contact</a>
        </aside>
        <article className="prose">
          <div className="callout">
            <h4>The short version</h4>
            <p>Cookies help Stowbo keep you signed in, remember your choices, and understand how the platform is used. Some are essential — disabling strictly-necessary cookies may break sign-in and checkout.</p>
          </div>

          <h2 id="what">What cookies are</h2>
          <p>Cookies are small text files placed on your device when you visit a website. They let a site remember your actions and preferences over time. We also use related technologies such as pixels, local storage, and software development kits, which we refer to together as &quot;cookies&quot; in this policy.</p>

          <h2 id="categories">Categories we use</h2>
          <p>We group the cookies we use into four categories:</p>
          <table>
            <thead>
              <tr><th>Category</th><th>Purpose</th><th>Examples</th><th>Duration</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Strictly Necessary</td>
                <td>Enable core features such as signing in, keeping your session, and completing checkout securely.</td>
                <td>Session token, load balancing, fraud checks</td>
                <td>Session to 12 months</td>
              </tr>
              <tr>
                <td>Performance / Analytics</td>
                <td>Help us understand how the platform is used so we can improve it.</td>
                <td>Page-view counts, aggregated usage stats</td>
                <td>Up to 24 months</td>
              </tr>
              <tr>
                <td>Functional</td>
                <td>Remember your choices and personalize the experience.</td>
                <td>Language, saved location, recently viewed</td>
                <td>Up to 12 months</td>
              </tr>
              <tr>
                <td>Advertising</td>
                <td>Measure and, where permitted, personalize the ads you see off-platform.</td>
                <td>Campaign attribution, audience tags</td>
                <td>Up to 13 months</td>
              </tr>
            </tbody>
          </table>

          <h2 id="third-party">Third-party cookies</h2>
          <p>Some cookies are set by trusted partners who provide analytics, payment, security, and advertising services on our behalf. These partners may use the information they collect according to their own privacy policies. We do not control cookies set on other websites you visit.</p>

          <h2 id="managing">Managing cookies</h2>
          <p>You can control non-essential cookies at any time through our <b>Cookie Preferences</b> center, available from the site footer. You can also manage or delete cookies through your browser settings, though blocking some cookies may affect how parts of the platform work.</p>

          <h2 id="dnt">Do Not Track</h2>
          <p>Some browsers offer a &quot;Do Not Track&quot; signal. Because there is no common industry standard for how to respond, we do not currently change our behavior based on that signal. Where a recognized opt-out preference signal is legally required, we honor it.</p>

          <h2 id="updates">Updates &amp; contact</h2>
          <p>We may revise this policy as our use of cookies changes and will update the date above when we do. If you have questions, contact us below.</p>

          <div className="contact-block">Questions? Email <a href="mailto:support@stowbo.com">support@stowbo.com</a>.</div>
        </article>
      </div></div>

      <SiteFooter />
    </>
  );
}
