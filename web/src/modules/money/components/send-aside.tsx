import type { TransferOptions } from "../api/types";
import { fmt } from "../lib/format";
import { Icon } from "./icons";

const KIND_TITLE: Record<TransferOptions["kind"], string> = {
  external: "Sending to another bank",
  internal: "Sending to a member",
  own: "Moving between your accounts",
};

/** Limits, speeds and fees for this way of sending — all as the bank reports them. */
export function SendAside({ options }: { options: TransferOptions }) {
  const hasDailyFigures = !!(options.dailyLimit && options.sentToday && options.remainingToday);
  const used = options.dailyLimit?.amount && options.sentToday ? Math.min(100, Math.round((options.sentToday.amount / options.dailyLimit.amount) * 100)) : 0;
  return (
    <aside className="mn-side mn-sendside">
      {hasDailyFigures && <section className="mn-panel">
        <div className="mn-panel-hd"><span>Left to send today</span></div>
        <div className="mn-limit-big">{fmt(options.remainingToday)}</div>
        <div className="mn-meter" aria-hidden><i style={{ width: `${Math.max(used, 1)}%` }} /></div>
        <p className="mn-muted mn-small">{fmt(options.sentToday)} sent of your {fmt(options.dailyLimit)} daily limit</p>
      </section>}
      <section className="mn-panel">
        <div className="mn-panel-hd"><span>{KIND_TITLE[options.kind]}</span></div>
        <ul className="mn-speeds">
          {options.speeds.map((s) => (
            <li key={s.speed}>
              <span className="mn-speed-ic"><Icon name={s.speed === "standard" ? "calendar" : "bolt"} size={17} /></span>
              <span><b>{s.label}</b><small>{s.timing}</small></span>
              <b className="mn-speed-fee">{s.fee.amount ? fmt(s.fee) : "Free"}</b>
            </li>
          ))}
        </ul>
        {options.cutoff && <p className="mn-muted mn-small" style={{ margin: "10px 0 0" }}>Cut-off: {options.cutoff}</p>}
      </section>
      {options.notes && options.notes.length > 0 && (
        <section className="mn-panel mn-sendnotes">
          <div className="mn-panel-hd"><span><Icon name="shield" size={15} /> Before you send</span></div>
          <ul className="mn-bullets">
            {options.notes.map((n) => <li key={n}><span>{n}</span></li>)}
          </ul>
        </section>
      )}
    </aside>
  );
}
