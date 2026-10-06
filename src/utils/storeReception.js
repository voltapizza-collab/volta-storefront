const translations = {
  es: {
    unknown: 'Sin confirmar',
    heading: 'Pedidos online', enabled: 'Habilitada', disabled: 'Deshabilitada', open: 'Abrir pedidos', close: 'Cerrar pedidos', closed: 'Pedidos cerrados', checking: 'Comprobando estado…', saving: 'Guardando…', retry: 'Reintentar', error: 'No se pudo confirmar el estado.', scheduled: 'Puedes recibir pedidos programados.',
    status: { open: 'Recibiendo pedidos', reception_closed: 'Pedidos cerrados', store_disabled: 'Tienda deshabilitada', paused: 'En pausa', outside_hours: 'Fuera de horario' },
    blockers: { store_disabled: 'Habilita la tienda.', partner_disabled: 'Volta debe habilitar el negocio.', coordinates: 'Completa la ubicación en Editar.', hours: 'Configura los horarios.', menu: 'Activa un producto con precio e ingredientes disponibles en Menú.', delivery_method: 'Selecciona recogida o delivery en Editar.', payment: 'Configura un medio de cobro disponible: tarjeta o efectivo autorizado para esta tienda.' },
  },
  en: {
    unknown: 'Not confirmed',
    heading: 'Online orders', enabled: 'Enabled', disabled: 'Disabled', open: 'Open orders', close: 'Close orders', closed: 'Orders closed', checking: 'Checking status…', saving: 'Saving…', retry: 'Retry', error: 'Unable to confirm status.', scheduled: 'Scheduled orders are available.',
    status: { open: 'Receiving orders', reception_closed: 'Orders closed', store_disabled: 'Store disabled', paused: 'Paused', outside_hours: 'Outside opening hours' },
    blockers: { store_disabled: 'Enable the store.', partner_disabled: 'Volta must enable the business.', coordinates: 'Complete the location in Edit.', hours: 'Set opening hours.', menu: 'Enable a priced product with available ingredients in Menu.', delivery_method: 'Select pickup or delivery in Edit.', payment: 'Configure an available payment method: card or cash authorized for this store.' },
  },
  it: {
    unknown: 'Non confermato',
    heading: 'Ordini online', enabled: 'Abilitato', disabled: 'Disabilitato', open: 'Apri ordini', close: 'Chiudi ordini', closed: 'Ordini chiusi', checking: 'Verifica dello stato…', saving: 'Salvataggio…', retry: 'Riprova', error: 'Impossibile confermare lo stato.', scheduled: 'Puoi ricevere ordini programmati.',
    status: { open: 'Ricezione ordini', reception_closed: 'Ordini chiusi', store_disabled: 'Negozio disabilitato', paused: 'In pausa', outside_hours: 'Fuori orario' },
    blockers: { store_disabled: 'Abilita il negozio.', partner_disabled: 'Volta deve abilitare l’attività.', coordinates: 'Completa la posizione in Modifica.', hours: 'Configura gli orari.', menu: 'Attiva un prodotto con prezzo e ingredienti disponibili in Menu.', delivery_method: 'Seleziona ritiro o consegna in Modifica.', payment: 'Configura un metodo disponibile: carta o contanti autorizzati per questo negozio.' },
  },
  fr: {
    unknown: 'Non confirmé',
    heading: 'Commandes en ligne', enabled: 'Activée', disabled: 'Désactivée', open: 'Ouvrir les commandes', close: 'Fermer les commandes', closed: 'Commandes fermées', checking: 'Vérification…', saving: 'Enregistrement…', retry: 'Réessayer', error: 'Impossible de confirmer l’état.', scheduled: 'Les commandes programmées sont disponibles.',
    status: { open: 'Réception des commandes', reception_closed: 'Commandes fermées', store_disabled: 'Boutique désactivée', paused: 'En pause', outside_hours: 'Hors horaires' },
    blockers: { store_disabled: 'Activez la boutique.', partner_disabled: 'Volta doit activer l’établissement.', coordinates: 'Complétez la localisation dans Modifier.', hours: 'Configurez les horaires.', menu: 'Activez un produit avec prix et ingrédients disponibles dans Menu.', delivery_method: 'Sélectionnez retrait ou livraison dans Modifier.', payment: 'Configurez un paiement disponible : carte ou espèces autorisées pour cette boutique.' },
  },
  pt: {
    unknown: 'Por confirmar',
    heading: 'Pedidos online', enabled: 'Habilitada', disabled: 'Desabilitada', open: 'Abrir pedidos', close: 'Fechar pedidos', closed: 'Pedidos fechados', checking: 'A verificar…', saving: 'A guardar…', retry: 'Tentar novamente', error: 'Não foi possível confirmar o estado.', scheduled: 'Podes receber pedidos agendados.',
    status: { open: 'A receber pedidos', reception_closed: 'Pedidos fechados', store_disabled: 'Loja desabilitada', paused: 'Em pausa', outside_hours: 'Fora do horário' },
    blockers: { store_disabled: 'Habilita a loja.', partner_disabled: 'A Volta deve habilitar o negócio.', coordinates: 'Completa a localização em Editar.', hours: 'Configura os horários.', menu: 'Ativa um produto com preço e ingredientes disponíveis em Menu.', delivery_method: 'Seleciona recolha ou entrega em Editar.', payment: 'Configura um pagamento disponível: cartão ou dinheiro autorizado para esta loja.' },
  },
};
export const receptionText = language => translations[String(language).toLowerCase().slice(0, 2)] || translations.es;
