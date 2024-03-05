'use strict';

import dayjs from 'dayjs';

export function formatDate(dateString: string = '') {
  if (dateString === '') {
    return dateString;
  }

  if (dayjs(dateString, 'DD MMMM YYYYY', true).isValid()) {
    return dayjs(dateString).format('DD MMMM YYYY');
  }

  return '';
}
