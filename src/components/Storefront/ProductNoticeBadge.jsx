import { normalizeProductNotices, productNoticeLabels } from '../../constants/productNotices';

export default function ProductNoticeBadge({ tags, language = 'es' }) {
  const keys = normalizeProductNotices(tags);
  if (!keys.length) return null;
  const labels = productNoticeLabels(language);
  const names = keys.map(key => labels[key]);
  const rotating = keys.length > 1;
  return <div className="lsf-productTags">
    <span className={`lsf-productTag lsf-noticeBadge lsf-productTag--${keys[0]}`}
      role="note" aria-label={names.join(', ')} title={names.join(' · ')}>
      <span key={keys.join(',')} className={`lsf-noticeTrack lsf-noticeTrack--${keys.length}`} aria-hidden="true">
        {names.map((name, index) => <span className={`lsf-noticeLine lsf-productTag--${keys[index]}`} key={keys[index]}>{name}</span>)}
        {rotating && <span className={`lsf-noticeLine lsf-noticeRepeat lsf-productTag--${keys[0]}`}>{names[0]}</span>}
      </span>
    </span>
  </div>;
}
