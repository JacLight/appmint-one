import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { CardArt } from "../bits";
import { Icon, type IconName } from "../icons";

const PHOTO = (id: number, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const PRODUCTS: { id: string; icon: IconName; title: string; body: string }[] = [
  { id: "checking", icon: "bank", title: "Checking", body: "No monthly fee" },
  { id: "savings", icon: "piggy", title: "Savings", body: "3.80% APY" },
  { id: "card", icon: "card", title: "Debit card", body: "Freeze in a tap" },
  { id: "send", icon: "sendUp", title: "Send money", body: "Three ways, one app" },
];

const FAQ = [
  { q: "How long does it take to open an account?", a: "About five minutes on your phone or laptop. You’ll need a U.S. address, your Social Security number and a photo ID." },
  { q: "How do I get my paycheck deposited?", a: "Give your employer your account and routing numbers from the Receive screen. You can share them straight from the app." },
  { q: "How fast are transfers?", a: "Between your own accounts and to anyone at Tidewell: instant, any day. To another bank: 1–3 business days, or same day when you send by 4 PM CT." },
  { q: "What happens if I lose my card?", a: "Freeze it in the app straight away. If it turns up, unfreeze it. If it doesn’t, message us and we’ll send a new one." },
  { q: "Are there fees?", a: "No monthly fee and no minimum balance. Any fee — like a same-day transfer — is shown on the review screen before you confirm, and it’s exactly what you pay." },
];

/** Tidewell's public front page: light, product-first, like a real bank's home. */
export async function BankHome() {
  const [setup, session] = await Promise.all([getSetup(), getSession()]);
  const name = setup.brand.name;
  const primary = session.signedIn ? { label: "Go to your accounts", href: "/account/banking/home" } : { label: "Open an account", href: "/signup" };
  return (
    <>
      <SiteHeader />
      <main className="mnh">
        {/* hero */}
        <section className="mnh-hero">
          <div className="wrap mnh-hero-in">
            <div className="mnh-hero-copy">
              <p className="mnh-eyebrow">Personal banking</p>
              <h1>Banking,<br />made clear.</h1>
              <p className="mnh-lead">Checking, savings and a debit card in one app. See every transaction the moment it happens, and send money to any bank — or anyone at {name} — in a few taps.</p>
              <div className="mnh-ctas">
                <Link className="btn clay lg" href={primary.href}>{primary.label}</Link>
                {!session.signedIn && <Link className="btn ghost lg" href="/login">Sign in</Link>}
              </div>
              <ul className="mnh-proof">
                <li><Icon name="check" size={15} />No monthly fees</li>
                <li><Icon name="check" size={15} />3.80% APY on savings</li>
                <li><Icon name="check" size={15} />Instant transfers to {name} members</li>
              </ul>
            </div>
            <div className="mnh-hero-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTO(10375885, 1100)} alt="A customer checking her balance on her phone in a café" />
              <div className="mnh-toast">
                <span className="mnh-toast-ic"><Icon name="receive" size={18} /></span>
                <span><b>You received $45.00</b><small>From Kwame · Dinner split · just now</small></span>
              </div>
              <div className="mnh-chipcard">
                <span className="mnh-dot" />Card frozen in one tap
              </div>
            </div>
          </div>
        </section>

        {/* product row */}
        <section className="mnh-products">
          <div className="wrap">
            <div className="mnh-prow">
              {PRODUCTS.map((p) => (
                <a key={p.id} href={`#${p.id}`} className="mnh-prod">
                  <span className="ic"><Icon name={p.icon} size={24} stroke={1.6} /></span>
                  <b>{p.title}</b>
                  <span>{p.body}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* checking — the product itself */}
        <section className="mnh-sec" id="checking">
          <div className="wrap mnh-split">
            <div className="mnh-copy">
              <p className="mnh-eyebrow">Everyday Checking</p>
              <h2>Your whole money picture, the second you sign in.</h2>
              <p>Balances first. Then send, receive and request right there. Then every transaction, with the merchant, the time and the running balance — searchable by name, amount or reference.</p>
              <ul className="mnh-list">
                <li><b>No monthly fee, no minimum balance.</b> Open with $0.</li>
                <li><b>Get paid on time.</b> Share your account and routing numbers in a tap for direct deposit.</li>
                <li><b>Statements on demand.</b> Every month, ready to print or save as a PDF.</li>
              </ul>
              <Link className="mnh-more" href={primary.href}>{session.signedIn ? "Go to your accounts" : "Open Everyday Checking"} <Icon name="send" size={16} /></Link>
            </div>
            <div className="mnh-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/tidewell/app-desktop.png" alt={`The ${name} banking home: total balance, accounts and recent activity`} />
            </div>
          </div>
        </section>

        {/* savings */}
        <section className="mnh-sec tight" id="savings">
          <div className="wrap">
            <div className="mnh-save">
              <div>
                <p className="mnh-eyebrow">High-Yield Savings</p>
                <div className="mnh-apy">3.80<small>% APY</small></div>
                <p className="mnh-save-lead">Interest paid every month, on every dollar. No minimum, no lock-up — move it back to checking instantly whenever you need it.</p>
              </div>
              <ul className="mnh-facts">
                <li><Icon name="piggy" size={22} stroke={1.6} /><b>No minimum balance</b><span>Earn from your first dollar.</span></li>
                <li><Icon name="calendar" size={22} stroke={1.6} /><b>Paid monthly</b><span>Interest lands on the last day of each month.</span></li>
                <li><Icon name="swap" size={22} stroke={1.6} /><b>Instant moves</b><span>Between checking and savings, any day, free.</span></li>
              </ul>
            </div>
            <p className="mnh-fine">APY is variable and can change. Shown for illustration until {name}’s partner bank publishes its rate sheet.</p>
          </div>
        </section>

        {/* send */}
        <section className="mnh-sec" id="send">
          <div className="wrap mnh-split rev">
            <div className="mnh-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTO(5053850, 1000)} alt="Sending money from a phone over coffee" />
            </div>
            <div className="mnh-copy">
              <p className="mnh-eyebrow">Send money</p>
              <h2>Three ways to send. Every detail before you confirm.</h2>
              <div className="mnh-ways">
                <div><span className="ic"><Icon name="bank" size={20} /></span><span><b>To another bank</b><small>Any U.S. account by routing and account number. 1–3 business days, or same day.</small></span></div>
                <div><span className="ic"><Icon name="bolt" size={20} /></span><span><b>To someone at {name}</b><small>By @handle, email or phone. Instant, any day, free.</small></span></div>
                <div><span className="ic"><Icon name="swap" size={20} /></span><span><b>Between your accounts</b><small>Checking to savings and back. Instant and free.</small></span></div>
              </div>
              <p className="mnh-note"><Icon name="request" size={16} /> Need paying back? Request money from anyone at {name}, or share a link.</p>
            </div>
          </div>
        </section>

        {/* card */}
        <section className="mnh-sec mnh-cardsec" id="card">
          <div className="wrap mnh-split">
            <div className="mnh-copy">
              <p className="mnh-eyebrow">{name} Visa debit</p>
              <h2>A card you control from your pocket.</h2>
              <ul className="mnh-list">
                <li><b>Freeze and unfreeze</b> in one tap when it goes missing.</li>
                <li><b>Set your own daily limits</b> for purchases and ATM cash.</li>
                <li><b>A virtual card</b> for subscriptions and online shopping.</li>
                <li><b>Every purchase, instantly</b> — with the merchant and where.</li>
              </ul>
            </div>
            <div className="mnh-cardstage">
              <CardArt card={{ last4: "7733", nameOnCard: "YOUR NAME", expMonth: 8, expYear: 2029, status: "active", form: "physical", network: "visa" }} brand={name} />
              <div className="mnh-ctl">
                <div className="mnh-ctl-row"><span><b>Freeze card</b><small>Unfreeze any time</small></span><i className="mnh-sw" /></div>
                <div className="mnh-ctl-row"><span><b>Purchases per day</b><small>Up to $10,000</small></span><b>$5,000</b></div>
                <div className="mnh-ctl-row"><span><b>ATM cash per day</b><small>Up to $1,000</small></span><b>$500</b></div>
              </div>
            </div>
          </div>
        </section>

        {/* security */}
        <section className="mnh-sec" id="security">
          <div className="wrap mnh-split">
            <div className="mnh-otp-demo" aria-hidden>
              <span className="mn-dialog-ic"><Icon name="shieldOk" size={24} /></span>
              <b>Confirm it’s you</b>
              <span className="mnh-otp-sub">Sending $250.00 to Jordan Ellis. Enter the 6-digit code we sent to (•••) •••-0142.</span>
              <div className="mnh-otp-boxes"><i>4</i><i>8</i><i>1</i><i>9</i><i /><i /></div>
            </div>
            <div className="mnh-copy">
              <p className="mnh-eyebrow">Security</p>
              <h2>Built so your money stays yours.</h2>
              <ul className="mnh-list">
                <li><b>A code before money leaves.</b> New recipients and transfers to other people need a one-time code.</li>
                <li><b>Numbers stay hidden.</b> Your full account number shows only after you confirm it’s you.</li>
                <li><b>Alerts in real time.</b> Every card purchase and transfer, the moment it happens.</li>
                <li><b>You’re in control.</b> Freeze your card, change limits and remove recipients yourself.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* app band */}
        <section className="mnh-sec tight">
          <div className="wrap">
            <div className="mnh-band">
              <div className="mnh-band-copy">
                <h2>Open an account in about five minutes.</h2>
                <p>All you need is your phone, a photo ID and your Social Security number. Your account and routing numbers are ready as soon as you’re approved.</p>
                <div className="mnh-ctas">
                  <Link className="btn lg mnh-btn-inv" href={primary.href}>{primary.label}</Link>
                  {!session.signedIn && <Link className="btn lg mnh-btn-ghost" href="/login">Sign in</Link>}
                </div>
              </div>
              <div className="mnh-phone">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brands/tidewell/app-phone.png" alt={`The ${name} app on a phone`} />
              </div>
            </div>
          </div>
        </section>

        {/* faq */}
        <section className="mnh-sec" id="faq">
          <div className="wrap mnh-faq">
            <h2>Questions, answered</h2>
            <div>
              {FAQ.map((f) => (
                <details key={f.q}><summary>{f.q}<Icon name="plus" size={18} /></summary><p>{f.a}</p></details>
              ))}
              <p className="mnh-fine" style={{ marginTop: 18 }}>More in the <Link href="/help">help center</Link>.</p>
            </div>
          </div>
        </section>

        <section className="mnh-disclose">
          <div className="wrap">
            {name} is a demonstration bank brand built on AppMint. Deposit accounts, cards and transfers are offered only once the bank’s legal entity and FDIC-insured partner bank are named on this page. Rates and features shown are for illustration.
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
