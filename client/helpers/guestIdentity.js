const STORAGE_KEY = 'wiki.guestIdentity'

function read () {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { name: '', email: '' }
    }
    const parsed = JSON.parse(raw)
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : ''
    }
  } catch (err) {
    return { name: '', email: '' }
  }
}

function write ({ name, email }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: (name || '').trim(),
      email: (email || '').trim()
    }))
  } catch (err) {
    // Ignore quota / private mode errors
  }
}

module.exports = {
  STORAGE_KEY,
  read,
  write
}
