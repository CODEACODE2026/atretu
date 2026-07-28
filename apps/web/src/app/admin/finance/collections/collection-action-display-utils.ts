import type { CollectionActionType } from "../../../../lib/api";

const contactActionTypes: CollectionActionType[] = [
  "CONTACT_ATTEMPT",
  "CONTACT_MADE",
  "NO_CONTACT",
];

export function collectionActionShowsChannel(
  actionType: CollectionActionType | "",
) {
  return contactActionTypes.includes(actionType as CollectionActionType) ||
    actionType === "PROMISE_TO_PAY";
}

export function collectionActionShowsContact(
  actionType: CollectionActionType | "",
) {
  return collectionActionShowsChannel(actionType);
}

export function collectionActionShowsPromise(
  actionType: CollectionActionType | "",
) {
  return actionType === "PROMISE_TO_PAY";
}

export function collectionActionShowsFollowUp(
  actionType: CollectionActionType | "",
) {
  return (
    actionType === "FOLLOW_UP_SCHEDULED" ||
    actionType === "PROMISE_TO_PAY" ||
    actionType === "NO_CONTACT"
  );
}

export function collectionActionHelp(actionType: CollectionActionType | "") {
  const labels: Record<CollectionActionType, string> = {
    CONTACT_ATTEMPT: "Registre uma tentativa sem contato efetivo.",
    CONTACT_MADE: "Registre o contato realizado com responsavel ou aluno.",
    PROMISE_TO_PAY: "Registre valor, data prometida e retorno quando necessario.",
    FOLLOW_UP_SCHEDULED: "Agende o proximo retorno operacional.",
    NO_CONTACT: "Registre ausencia de contato e um retorno se fizer sentido.",
    PARTIAL_PAYMENT_REVIEW_NOTE: "Registre uma observacao sobre baixa parcial.",
    INTERNAL_NOTE: "Adicione uma nota interna ao historico do caso.",
  };
  return actionType ? labels[actionType] : "Escolha o tipo para exibir os campos corretos.";
}
