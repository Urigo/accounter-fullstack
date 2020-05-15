console.log('this should display only in browser');

export function printElement(clickedElement: HTMLElement, newValue: string) {
  const changeRequest = {
    newValue: newValue,
    propertyToChange: clickedElement.className,
    bank_reference: clickedElement!.parentElement!.getAttribute(
      'bank_reference'
    ),
    account_number: clickedElement!.parentElement!.getAttribute(
      'account_number'
    ),
    account_type: clickedElement!.parentElement!.getAttribute('account_type'),
    currency_code: clickedElement!.parentElement!.getAttribute('currency_code'),
    event_date: clickedElement!.parentElement!.getAttribute('event_date'),
    event_amount: clickedElement!.parentElement!.getAttribute('event_amount'),
    event_number: clickedElement!.parentElement!.getAttribute('event_number'),
  };
  console.log(changeRequest);

  fetch('/editProperty', {
    method: 'POST',
    body: JSON.stringify(changeRequest),
  }).then((response) => {
    console.log('Request complete! response:', response);
  });
}

export function changeConfirmation(id: string, checkbox: HTMLInputElement) {
  const changeRequest = {
    id,
    reviewed: checkbox.checked,
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
