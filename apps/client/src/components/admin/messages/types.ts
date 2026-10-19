export type MessageStatus = 'NEW' | 'HANDLED';

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderNumber: string | null;
  subject: string | null;
  message: string;
  locale: string;
  status: MessageStatus;
  createdAt: string;
};

export type MessageFilter = 'ALL' | MessageStatus;

/** `mailto:` link that replies to the message, quoting it. */
export function replyMailto(m: ContactMessage, replySubject: string) {
  const subject = m.subject ? `${replySubject} - ${m.subject}` : replySubject;
  const quoted = m.message
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n${quoted}`)}`;
}
