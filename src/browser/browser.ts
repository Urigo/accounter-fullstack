console.log('this should display only in browser');

export function printElement(clickedElement: HTMLElement, newValue: string) {
  const changeRequest = {
    newValue: newValue,
    propertyToChange: clickedElement!.parentElement!.getAttribute('class'),
    id: clickedElement!.parentElement!.parentElement!.getAttribute(
      'transaction_id'
    ),
    bank_reference: clickedElement!.parentElement!.parentElement!.getAttribute(
      'bank_reference'
    ),
    account_number: clickedElement!.parentElement!.parentElement!.getAttribute(
      'account_number'
    ),
    account_type: clickedElement!.parentElement!.parentElement!.getAttribute(
      'account_type'
    ),
    currency_code: clickedElement!.parentElement!.parentElement!.getAttribute(
      'currency_code'
    ),
    event_date: clickedElement!.parentElement!.parentElement!.getAttribute(
      'event_date'
    ),
    event_amount: clickedElement!.parentElement!.parentElement!.getAttribute(
      'event_amount'
    ),
    event_number: clickedElement!.parentElement!.parentElement!.getAttribute(
      'event_number'
    ),
  };
  console.log(changeRequest);

  fetch('/editProperty', {
    method: 'POST',
    body: JSON.stringify(changeRequest),
  }).then((response) => {
    console.log('Request complete! response:', response);
  });
}

export function changeConfirmation(
  id: string,
  checkbox: HTMLInputElement,
  accountType: string
) {
  const changeRequest = {
    id,
    reviewed: checkbox.checked,
    accountType,
  };
  console.log(changeRequest);

  fetch('/reviewTransaction', {
    method: 'POST',
    body: JSON.stringify(changeRequest),
  }).then((response) => {
    console.log('Review request complete! response:', response);
  });
}

export function setSelected(elementToSelect: HTMLElement) {
  if (document.getElementsByClassName('selected').length) {
    let currentSelectedElement = document.getElementsByClassName('selected')[0];
    currentSelectedElement.classList.remove('selected');
  }
  elementToSelect?.classList.add('selected');
}


export function generateTaxMovements(transactionId: string) {
  const changeRequest = { transactionId };
  console.log(changeRequest);

  fetch('/generateTaxMovements', {
    method: 'POST',
    body: JSON.stringify(changeRequest),
  }).then((response) => {
    console.log('Request complete! response:', response);
  });
}

