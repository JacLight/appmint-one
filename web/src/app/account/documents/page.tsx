import { PageTitle } from "@/components/dashboard-shell";
import { DocumentLibrary } from "@/components/documents/document-library";
import { getSetup } from "@/lib/setup";
import { documents, type CustomerFile, type FormRequest } from "@/lib/documents";
import { fmtFull } from "@/lib/dates";

export const metadata = { title: "Documents" };

/** Documents — common to every setup. What works today is the customer's own file
 *  space; the shared/e-sign pieces have no customer-side API yet and are shown as
 *  such (see the "Not available yet" cards). */
export default async function DocumentsPage() {
  const setup = await getSetup();
  const [filesR, formsR] = await Promise.allSettled([documents.list(), documents.forms()]);
  const files: CustomerFile[] = filesR.status === "fulfilled" && Array.isArray(filesR.value?.files) ? filesR.value.files : [];
  const forms: FormRequest[] = formsR.status === "fulfilled" && Array.isArray(formsR.value?.data) ? formsR.value.data : [];
  const listFailed = filesR.status === "rejected";

  return (
    <>
      <PageTitle title="Documents" />
      <p className="muted docs-lead">Your files with {setup.brand.name} — kept private to you and the business.</p>
      {listFailed && <div className="bp-error">Your documents couldn’t be loaded just now. Refresh to try again.</div>}
      <DocumentLibrary files={files} />

      <h2 className="docs-h2">Forms</h2>
      {forms.length === 0 ? (
        <div className="tcard docs-empty"><p className="muted">Forms you’ve filled in — and any we’ve asked you to complete — show up here.</p></div>
      ) : (
        <div className="docs-list">
          {forms.map((f) => (
            <div className="docs-row" key={f.id}>
              <span className="docs-ext">FORM</span>
              <div className="docs-main">
                <b>{f.form?.title || f.form?.name || "Form"}</b>
                <span>{f.status === "pending" ? `Requested${f.requestedAt ? ` ${fmtFull(f.requestedAt)}` : ""}` : f.submittedAt ? `Submitted ${fmtFull(f.submittedAt)}` : f.status}</span>
              </div>
              <span className={`hp-pill ${f.status === "pending" ? "wait" : "ok"}`}>{f.status === "pending" ? "Waiting on you" : "Done"}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="docs-h2">Shared with you &amp; signatures</h2>
      <div className="docs-soon">
        {[
          { t: "Shared folders", d: "Folders the business shares with you, with everything they’ve added." },
          { t: "Sign documents", d: "Review and e-sign documents sent to you, then download the signed copy." },
          { t: "Templates to fill", d: "Fill in the business’s templates right here instead of on paper." },
        ].map((x) => (
          <div className="tcard docs-soon-card" key={x.t} aria-disabled>
            <b>{x.t}</b>
            <p className="muted">{x.d}</p>
            <span className="soon-chip">Not available yet</span>
          </div>
        ))}
      </div>
    </>
  );
}
