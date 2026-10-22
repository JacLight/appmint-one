/** Skeletons for the booking screens: the same shapes as the real thing, shimmering, so the
 *  page holds its layout while doctors and their open times load. */

const CHIPS = [14, 10, 12, 8];

export function PersonSkeleton({ n = 0 }: { n?: number }) {
  return (
    <div className="dr sk-card" aria-hidden style={{ animationDelay: `${n * 90}ms` }}>
      <div className="dr-who">
        <span className="sk sk-av" />
        <div className="sk-lines" style={{ paddingTop: 4 }}>
          <span className="sk sk-l" style={{ width: "75%" }} />
          <span className="sk sk-s" style={{ width: "60%" }} />
          <span className="sk sk-s" style={{ width: "90%", marginTop: 8 }} />
          <span className="sk sk-s" style={{ width: "70%" }} />
          <span className="sk sk-s" style={{ width: "50%", marginTop: 8 }} />
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <span className="sk sk-seg" />
        <div className="sk-times">{Array.from({ length: CHIPS[n % CHIPS.length] }, (_, i) => <span key={i} className="sk sk-chip" />)}</div>
      </div>
    </div>
  );
}

export function PeopleSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <span className="sk-status" role="status">Finding open times…</span>
      {Array.from({ length: count }, (_, i) => <PersonSkeleton key={i} n={i} />)}
    </>
  );
}

/** The whole booking page while it loads for the first time. */
export function BookPageSkeleton({ style }: { style?: "studio" | "clinic" | "firm" }) {
  return (
    <div className={`scm sk-page ${style === "firm" ? "sc-firm" : style === "studio" ? "sc-studio" : "sc-clinic"}`}>
      <section className="bk-band bk-band-tight">
        <div className="wrap">
          <div className="sk-lines" style={{ marginBottom: 22 }}>
            <span className="sk sk-s" style={{ width: 150 }} />
            <span className="sk sk-h" style={{ width: "min(380px, 80%)" }} />
          </div>
          <span className="sk" style={{ height: 66, borderRadius: 16 }} />
        </div>
      </section>
      <section className="wrap bk-body bk-list">
        <span className="sk sk-s" style={{ width: 220, marginBottom: 16 }} />
        <PeopleSkeleton />
      </section>
    </div>
  );
}

/** One person's booking page (pick a day and time, then confirm) while it loads. */
export function TypePageSkeleton() {
  return (
    <div className="scm sk-page">
      <section className="wrap bt-grid" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <div className="bt-main">
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 34 }}>
            <span className="sk" style={{ width: 260, height: 220, borderRadius: 18, flex: "none" }} />
            <div className="sk-lines" style={{ paddingTop: 20 }}>
              <span className="sk sk-s" style={{ width: 90 }} />
              <span className="sk sk-h" style={{ width: "70%" }} />
              <span className="sk sk-s" style={{ width: "90%" }} />
              <span className="sk sk-s" style={{ width: "60%" }} />
            </div>
          </div>
          <span className="sk sk-h2" style={{ width: 180, marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 8, overflow: "hidden", marginBottom: 20 }}>{Array.from({ length: 9 }, (_, i) => <span key={i} className="sk sk-tab" />)}</div>
          <div className="sk-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>{Array.from({ length: 8 }, (_, i) => <span key={i} className="sk sk-chip" />)}</div>
        </div>
        <aside className="bt-side"><span className="sk" style={{ height: 420, borderRadius: 18 }} /></aside>
      </section>
      <span className="sk-status" role="status">Loading open times…</span>
    </div>
  );
}
