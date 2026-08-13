// Vistas de autenticación: login (#/login) y registro (#/register) con validación local y errores del backend.
import { login, register } from '../app.js';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function renderLogin(view) {
  paint(view, 'login');
}

export async function renderRegister(view) {
  paint(view, 'register');
}

function paint(view, mode) {
  const isLogin = mode === 'login';
  view.innerHTML = `
    <section class="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">${isLogin ? 'Inicia sesión' : 'Crear cuenta'}</h1>
      <form id="auth-form" class="form" novalidate>
        ${isLogin ? '' : `
          <label class="field">
            <span>Nombre público (2–40)</span>
            <input id="auth-name" name="publicName" type="text" maxlength="40" autocomplete="nickname" required />
          </label>
        `}
        <label class="field">
          <span>Correo electrónico</span>
          <input id="auth-email" name="email" type="email" maxlength="120" autocomplete="email" required />
        </label>
        <label class="field">
          <span>Contraseña${isLogin ? '' : ' (mín. 8, con mayúscula, minúscula y número)'}</span>
          <input id="auth-password" name="password" type="password" minlength="8" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required />
        </label>
        <p id="auth-error" class="alert" role="alert" hidden></p>
        <button type="submit" class="primary" id="auth-submit">${isLogin ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <p class="meta" style="text-align:center; margin-top:1rem;">
        ${isLogin
          ? '¿Aún no tienes cuenta? <a href="#/register">Crea una</a>'
          : '¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a>'}
      </p>
    </section>
  `;

  const form = view.querySelector('#auth-form');
  const error = view.querySelector('#auth-error');
  const submit = view.querySelector('#auth-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    error.textContent = '';

    const email = view.querySelector('#auth-email').value.trim();
    const password = view.querySelector('#auth-password').value;
    if (!email || !emailPattern.test(email)) {
      showError(error, 'Introduce un correo válido.');
      return;
    }
    if (!password || password.length < 8) {
      showError(error, 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    let name = '';
    if (!isLogin) {
      name = view.querySelector('#auth-name').value.trim();
      if (name.length < 2 || name.length > 40) {
        showError(error, 'El nombre público debe tener entre 2 y 40 caracteres.');
        return;
      }
      if (!passwordPattern.test(password)) {
        showError(error, 'La contraseña necesita mayúscula, minúscula y un número.');
        return;
      }
    }

    submit.disabled = true;
    submit.textContent = isLogin ? 'Entrando...' : 'Creando cuenta...';
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register({ email, password, publicName: name });
      }
      window.location.hash = '#/';
    } catch (err) {
      showError(error, err.message || 'No hemos podido completar la acción.');
    } finally {
      submit.disabled = false;
      submit.textContent = isLogin ? 'Entrar' : 'Crear cuenta';
    }
  });
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
