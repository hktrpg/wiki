const STORAGE_KEY = 'wiki.guestIdentity'
const COOKIE_EMAIL = 'wikiGuestEmail'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60

function readCookie (name) {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : ''
  } catch (err) {
    return ''
  }
}

function writeCookie (name, value) {
  try {
    const encoded = encodeURIComponent(value || '')
    document.cookie = `${name}=${encoded};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`
  } catch (err) {
    // Ignore cookie write failures
  }
}

function read () {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const cookieEmail = readCookie(COOKIE_EMAIL)
      return { name: '', email: cookieEmail }
    }
    const parsed = JSON.parse(raw)
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : (readCookie(COOKIE_EMAIL) || '')
    }
  } catch (err) {
    return { name: '', email: readCookie(COOKIE_EMAIL) || '' }
  }
}

function write ({ name, email }) {
  const cleanName = (name || '').trim()
  const cleanEmail = (email || '').trim().toLowerCase()
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: cleanName,
      email: cleanEmail
    }))
  } catch (err) {
    // Ignore quota / private mode errors
  }
  writeCookie(COOKIE_EMAIL, cleanEmail)
}

module.exports = {
  STORAGE_KEY,
  COOKIE_EMAIL,
  read,
  write
}
