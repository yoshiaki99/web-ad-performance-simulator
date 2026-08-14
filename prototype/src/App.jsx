import { useEffect, useMemo, useState } from "react";
import {
  FiArchive,
  FiBarChart2,
  FiBookOpen,
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiEdit3,
  FiHelpCircle,
  FiInfo,
  FiLock,
  FiSave,
  FiSliders,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const DRAFT_KEY = "ad-simulator:draft:v1";
const SAVED_KEY = "ad-simulator:saved:v1";

const defaultValues = {
  budget: "300000",
  cpc: "150",
  cvr: "2",
  unitPrice: "20000",
  margin: "40",
  closeRate: "100",
  monthlyFee: "0",
  initialFee: "0",
};

const inputFields = [
  { key: "budget", number: "1", label: "月の広告予算", helper: "1か月あたりの広告に使う金額", unit: "円", min: 1, step: 1000 },
  { key: "cpc", number: "2", label: "クリック単価（CPC）", helper: "広告が1回クリックされる平均費用", unit: "円", min: 1, step: 1 },
  { key: "cvr", number: "3", label: "コンバージョン率（CVR）", helper: "クリックのうち成果につながる割合", unit: "%", min: 0.01, max: 100, step: 0.1 },
  { key: "unitPrice", number: "4", label: "顧客単価（平均購入金額）", helper: "1回の購入・成約あたりの平均金額", unit: "円", min: 0, step: 1000 },
  { key: "margin", number: "5", label: "原価・変動費の割合", helper: "売上に対してかかる仕入れ・発送などの費用", unit: "%", min: 0, max: 100, step: 1 },
];

function number(value) {
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function yen(value, digits = 0) {
  if (!Number.isFinite(value)) return "算出不可";
  return `¥${Math.round(value).toLocaleString("ja-JP", { maximumFractionDigits: digits })}`;
}

function count(value) {
  if (!Number.isFinite(value)) return "算出不可";
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}件`;
}

function percent(value) {
  if (!Number.isFinite(value)) return "算出不可";
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`;
}

function calculate(values, cvrModifier = 1, cpcModifier = 1) {
  const budget = number(values.budget);
  const cpc = number(values.cpc) * cpcModifier;
  const cvr = (number(values.cvr) / 100) * cvrModifier;
  const unitPrice = number(values.unitPrice);
  const variableCostRate = number(values.margin) / 100;
  const closeRate = number(values.closeRate || 100) / 100;
  const monthlyFee = number(values.monthlyFee);
  const initialFee = number(values.initialFee);
  const clicks = cpc > 0 ? budget / cpc : 0;
  const cvs = clicks * cvr;
  const closed = cvs * closeRate;
  const sales = closed * unitPrice;
  const grossProfit = sales * (1 - variableCostRate);
  const profit = grossProfit - budget - monthlyFee;
  const cpa = cvs > 0 ? budget / cvs : NaN;
  const roas = budget > 0 ? (sales / budget) * 100 : NaN;
  const breakEvenClosed = unitPrice * (1 - variableCostRate) > 0 ? (budget + monthlyFee) / (unitPrice * (1 - variableCostRate)) : NaN;
  const breakEvenCvr = clicks * closeRate > 0 ? (breakEvenClosed / (clicks * closeRate)) * 100 : NaN;

  return { budget, cpc, cvr, clicks, cvs, closed, sales, grossProfit, profit, initialProfit: profit - initialFee, cpa, roas, breakEvenClosed, breakEvenCvr };
}

function emptyErrors(values) {
  const errors = {};
  for (const field of inputFields) {
    const value = number(values[field.key]);
    if (values[field.key] === "" || value < field.min || (field.max && value > field.max)) {
      errors[field.key] = field.max
        ? `${field.min}〜${field.max}の範囲で入力してください。`
        : `${field.min}以上を入力してください。`;
    }
  }
  return errors;
}

function App() {
  const [values, setValues] = useState(defaultValues);
  const [savedAt, setSavedAt] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedItems, setSavedItems] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      const saved = localStorage.getItem(SAVED_KEY);
      if (draft) setValues({ ...defaultValues, ...JSON.parse(draft) });
      if (saved) setSavedItems(JSON.parse(saved));
    } catch {
      setToast("保存データを読み込めませんでした。");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        setSavedAt(new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      } catch {
        setToast("一時保存できませんでした。");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const errors = useMemo(() => emptyErrors(values), [values]);
  const completed = inputFields.length - Object.keys(errors).length;
  const result = useMemo(() => calculate(values), [values]);
  const scenarios = useMemo(() => [
    { label: "控えめ", description: "CVR -20% / CPC +20%", result: calculate(values, 0.8, 1.2) },
    { label: "標準", description: "入力した条件", result: calculate(values) },
    { label: "強気", description: "CVR +20% / CPC -20%", result: calculate(values, 1.2, 0.8) },
  ], [values]);

  const updateValue = (key, value) => {
    if (value === "" || /^\d*(\.\d*)?$/.test(value)) {
      setValues((current) => ({ ...current, [key]: value }));
    }
  };

  const openSaveDialog = () => {
    setSaveName(`シミュレーション ${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date())}`);
    setSaveDialog(true);
  };

  const persistSaved = (next) => {
    setSavedItems(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  };

  const saveSimulation = (event) => {
    event.preventDefault();
    const item = {
      id: crypto.randomUUID(),
      name: saveName.trim() || "未命名のシミュレーション",
      savedAt: new Date().toISOString(),
      values,
      summary: { budget: result.budget, profit: result.profit, cvs: result.cvs },
    };
    persistSaved([item, ...savedItems]);
    setSaveDialog(false);
    setToast("シミュレーションを保存しました。");
  };

  const loadItem = (item) => {
    setValues({ ...defaultValues, ...item.values });
    setLibraryOpen(false);
    setToast(`「${item.name}」を読み込みました。`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateItem = (item) => {
    const duplicate = { ...item, id: crypto.randomUUID(), name: `${item.name} のコピー`, savedAt: new Date().toISOString() };
    persistSaved([duplicate, ...savedItems]);
    setToast("コピーを作成しました。");
  };

  const deleteItem = (id) => {
    persistSaved(savedItems.filter((entry) => entry.id !== id));
    setPendingDelete(null);
    setToast("保存済みデータを削除しました。");
  };

  const clearDraft = () => {
    setValues(defaultValues);
    localStorage.removeItem(DRAFT_KEY);
    setToast("入力内容を初期値に戻しました。");
  };

  const verdict = Object.keys(errors).length > 0
    ? { title: "入力すると結果が表示されます", copy: "左の5項目を入力すると、ここに利益の見込みが表示されます。", tone: "neutral" }
    : result.profit > 0
      ? { title: "黒字の見込みです！", copy: `この条件なら、広告費を引いても月約${yen(result.profit)}の利益が見込めます。`, tone: "positive" }
      : result.profit === 0
        ? { title: "ほぼ収支ゼロの見込みです", copy: "この条件では、広告費を差し引くとほぼ収支ゼロの見込みです。", tone: "neutral" }
        : { title: "赤字になる見込みです", copy: `この条件では、広告費を引くと月約${yen(Math.abs(result.profit))}の赤字となる見込みです。`, tone: "negative" };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">小さなビジネスの広告投資判断を、シンプルに。</p>
          <h1>ウェブ広告パフォーマンスシミュレーター</h1>
        </div>
        <div className="header-actions">
          <button className="saved-link" type="button" onClick={() => setLibraryOpen(true)}><FiArchive /> 保存済み（{savedItems.length}）</button>
          <div className="autosave"><span className="status-dot" /> 一時保存済み <small>{savedAt ? `${savedAt}に保存` : ""}</small></div>
          <button className="primary-button header-save" type="button" onClick={openSaveDialog}><FiSave /> 保存する</button>
        </div>
      </header>

      <section className="simulator-grid">
        <form className="inputs-panel" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading">
            <span className="heading-icon"><FiEdit3 /></span>
            <div><h2>あなたのビジネスの条件を入力しましょう</h2><p>5つの項目を入力すると、右側に利益の見込みが表示されます。</p></div>
            <span className="remaining">あと{5 - completed}項目</span>
          </div>
          <div className="input-list">
            {inputFields.map((field) => (
              <label className="input-row" key={field.key}>
                <span className="input-number">{field.number}</span>
                <span className="field-copy"><strong>{field.label}</strong><small>{field.helper}</small>{errors[field.key] && <em>{errors[field.key]}</em>}</span>
                <span className="number-input"><input aria-label={field.label} inputMode="decimal" value={values[field.key]} onChange={(event) => updateValue(field.key, event.target.value)} min={field.min} max={field.max} step={field.step} /><b>{field.unit}</b></span>
              </label>
            ))}
          </div>
          <button className="details-toggle options-toggle" type="button" onClick={() => setOptionsOpen((open) => !open)}><FiSliders /> 詳しい条件を{optionsOpen ? "閉じる" : "設定する"} {optionsOpen ? <FiChevronUp /> : <FiChevronDown />}</button>
          {optionsOpen && <div className="optional-fields">
            <label>CV後の成約率 <input inputMode="decimal" value={values.closeRate} onChange={(event) => updateValue("closeRate", event.target.value)} /><span>%</span></label>
            <label>月額運用手数料 <input inputMode="numeric" value={values.monthlyFee} onChange={(event) => updateValue("monthlyFee", event.target.value)} /><span>円</span></label>
            <label>初期費用 <input inputMode="numeric" value={values.initialFee} onChange={(event) => updateValue("initialFee", event.target.value)} /><span>円</span></label>
          </div>}
          <aside className="beginner-note"><FiHelpCircle /><div><strong>はじめての方へ</strong><p>わからない項目は、目安の数字を入れて進められます。あとからいつでも見直せます。</p></div></aside>
          <p className="privacy-note"><FiLock />入力した数値はお使いのブラウザ内にだけ保存され、外部には送信されません。</p>
        </form>

        <section className="results-panel" aria-live="polite">
          <div className="results-heading"><span className="heading-icon"><FiBarChart2 /></span><h2>あなたの広告の見込み <small>（1か月あたり）</small></h2></div>
          <div className="hero-result">
            <div className="profit-block"><span>見込まれる月間の利益</span><strong className={result.profit < 0 ? "negative-number" : ""}>{Object.keys(errors).length ? "—" : yen(result.profit)}</strong></div>
            <div className={`verdict ${verdict.tone}`}><div className="verdict-mark">{verdict.tone === "positive" ? "✓" : "i"}</div><div><strong>{verdict.title}</strong><p>{verdict.copy}</p><small>※ あくまでシミュレーションの概算です。結果を保証するものではありません。</small></div></div>
            <div className="metric-row">
              <Metric label="クリック数（見込み）" value={Object.keys(errors).length ? "—" : `${result.clicks.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}回`} />
              <Metric label="コンバージョン数（見込み）" value={Object.keys(errors).length ? "—" : count(result.cvs)} />
              <Metric label="売上（見込み）" value={Object.keys(errors).length ? "—" : yen(result.sales)} />
              <Metric label="利益率（見込み）" value={Object.keys(errors).length ? "—" : percent(result.sales ? (result.profit / result.sales) * 100 : NaN)} />
            </div>
          </div>

          <section className="sensitivity">
            <div className="sensitivity-heading"><FiInfo /><div><h3>数字が変わると、利益はどう変わる？</h3><p>気になる項目の数字を動かすと、利益の変化を確認できます。</p></div></div>
            <div className="scenario-grid">
              {scenarios.map((scenario) => <Scenario key={scenario.label} {...scenario} />)}
            </div>
          </section>

          <button className="details-toggle" type="button" onClick={() => setDetailsOpen((open) => !open)}><FiBookOpen /> 計算の詳細を{detailsOpen ? "閉じる" : "表示"} {detailsOpen ? <FiChevronUp /> : <FiChevronDown />}</button>
          {detailsOpen && <div className="details-content">
            <div><span>想定クリック数</span><b>{yen(result.budget)} ÷ {yen(result.cpc)} = {result.clicks.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}回</b></div>
            <div><span>想定コンバージョン数</span><b>{result.clicks.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}回 × {percent(result.cvr * 100)} = {count(result.cvs)}</b></div>
            <div><span>CPA（1件の成果を得る費用）</span><b>{yen(result.cpa)}</b></div>
            <div><span>ROAS（広告費に対する売上）</span><b>{percent(result.roas)}</b></div>
            <div><span>損益分岐コンバージョン率</span><b>{percent(result.breakEvenCvr)}</b></div>
            <div><span>初月利益（初期費用を含む）</span><b>{yen(result.initialProfit)}</b></div>
          </div>}
        </section>
      </section>

      <footer className="app-footer"><button className="primary-button footer-save" type="button" onClick={openSaveDialog}><FiSave /> 保存する</button><span className="autosave"><span className="status-dot" /> 一時保存済み <small>{savedAt ? `${savedAt}に保存` : ""}</small></span><button className="text-button" type="button" onClick={clearDraft}>入力を初期値に戻す</button></footer>

      {toast && <div className="toast" role="status">{toast}</div>}
      {saveDialog && <Modal title="シミュレーションを保存" onClose={() => setSaveDialog(false)}><form className="save-form" onSubmit={saveSimulation}><label>保存する名前<input autoFocus value={saveName} onChange={(event) => setSaveName(event.target.value)} maxLength="80" /></label><p>このブラウザに保存されます。ブラウザのサイトデータを削除すると、保存した内容も削除されます。</p><div><button type="button" className="secondary-button" onClick={() => setSaveDialog(false)}>キャンセル</button><button type="submit" className="primary-button"><FiSave /> 保存する</button></div></form></Modal>}
      {libraryOpen && <aside className="library" aria-label="保存済みシミュレーション"><div className="library-head"><div><h2>保存済みシミュレーション</h2><p>このブラウザに保存されています。</p></div><button type="button" aria-label="閉じる" onClick={() => setLibraryOpen(false)}><FiX /></button></div>{savedItems.length === 0 ? <div className="empty-library"><FiArchive /><p>まだ保存したシミュレーションはありません。</p></div> : <div className="saved-list">{savedItems.map((item) => <article className="saved-item" key={item.id}><div><h3>{item.name}</h3><p>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.savedAt))}</p><dl><div><dt>広告予算</dt><dd>{yen(item.summary.budget)}</dd></div><div><dt>見込CV数</dt><dd>{count(item.summary.cvs)}</dd></div><div><dt>月間利益</dt><dd className={item.summary.profit < 0 ? "negative-number" : ""}>{yen(item.summary.profit)}</dd></div></dl></div><div className="saved-actions">{pendingDelete === item.id ? <><span>削除しますか？</span><button onClick={() => deleteItem(item.id)} type="button" className="delete-confirm">削除</button><button onClick={() => setPendingDelete(null)} type="button">戻る</button></> : <><button onClick={() => loadItem(item)} type="button">読み込む</button><button onClick={() => duplicateItem(item)} type="button" aria-label={`${item.name}を複製`}><FiCopy /></button><button onClick={() => setPendingDelete(item.id)} type="button" aria-label={`${item.name}を削除`}><FiTrash2 /></button></>}</div></article>)}</div>}</aside>}
      {libraryOpen && <button className="scrim" aria-label="一覧を閉じる" type="button" onClick={() => setLibraryOpen(false)} />}
    </main>
  );
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function Scenario({ label, description, result }) { return <article className={`scenario ${label === "標準" ? "standard" : ""}`}><span>{label}</span><small>{description}</small><strong className={result.profit < 0 ? "negative-number" : ""}>{yen(result.profit)}</strong><p>月間利益（見込み）</p></article>; }
function Modal({ title, children, onClose }) { return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" type="button" aria-label="閉じる" onClick={onClose} /><section className="modal"><button className="close-modal" type="button" aria-label="閉じる" onClick={onClose}><FiX /></button><h2>{title}</h2>{children}</section></div>; }

export { App };
