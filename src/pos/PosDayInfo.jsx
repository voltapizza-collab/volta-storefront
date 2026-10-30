import { memo, useEffect, useState } from 'react';
import { emptyDayInfo, loadDayInfo } from './dayInfo';

export default memo(function PosDayInfo({ city, zipCode, latitude, longitude }) {
  const [info, setInfo] = useState(emptyDayInfo);
  const [selectedDay, setSelectedDay] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await loadDayInfo({ city, zipCode, latitude, longitude });
      if (!cancelled) setInfo(current => JSON.stringify(current) === JSON.stringify(result) ? current : result);
    };
    setInfo(emptyDayInfo());
    setSelectedDay(null);
    refresh();
    // Local date rollover; the shared cache controls all network requests.
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    const resume = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [city, zipCode, latitude, longitude]);
  const adverseDays = info.days.filter(day => day.alert);
  const selected = adverseDays.find(day => day.date === selectedDay);
  const { holiday } = info;
  return <details className={`pos-dayOutlook${holiday?.alert ? ' pos-dayOutlook--holiday' : ''}`}>
    <summary>
      <span>Clima y próximos festivos:</span>
      {holiday?.alert && <strong className="pos-dayHolidayAlert" role="status">
        ⚠ Festivo {holiday.relative}
      </strong>}
      {adverseDays.length > 0 && <span className="pos-dayWeatherIndicator" role="img" aria-label={`Previsión adversa · ${adverseDays.length} ${adverseDays.length === 1 ? 'día' : 'días'}`} title="Previsión adversa: abre el panel y toca el día señalado">⛈</span>}
    </summary>
    <div className="pos-dayInfoGrid" aria-label="Clima de tres días y próximo festivo">
      {info.days.map(day => {
        const content = <><em>{day.label}</em><span className="pos-dayWeatherIcon" role="img" aria-label={day.condition}>{day.icon}</span><b><span aria-label="Temperatura mínima">Mín. {day.min ?? '—'}°</span> · <span aria-label="Temperatura máxima">Máx. {day.max ?? '—'}°</span></b></>;
        return day.alert
          ? <button key={day.date} type="button" className="pos-dayInfoChip pos-dayInfoChip--adverse" aria-label={`${day.label}: ${day.alert.title}. Consultar impacto operativo`} aria-expanded={selectedDay === day.date} aria-controls="pos-dayWeatherMessage" onClick={() => setSelectedDay(current => current === day.date ? null : day.date)}>{content}</button>
          : <div key={day.date} className="pos-dayInfoChip">{content}</div>;
      })}
      <div className="pos-dayInfoChip pos-dayHolidayCard">
        <em>Próximo festivo</em>
        {holiday ? <><time dateTime={holiday.date}>{holiday.dateLabel}</time><b>{holiday.name}</b><span>{holiday.scope}</span></> : <b>{info.loading ? 'Cargando…' : 'Sin próximo festivo registrado'}</b>}
      </div>
    </div>
    <div id="pos-dayWeatherMessage" hidden={!selected} className="pos-dayWeatherMessage" role="status">
      {selected && <><strong>{selected.label}: {selected.alert.title}.</strong> {selected.alert.message}</>}
    </div>
    {info.status.length > 0 && <p className="pos-dayInfoStatus">{info.status.join(' ')}</p>}
  </details>;
});
