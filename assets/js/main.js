// NXT Team Blog - Main JavaScript

// Theme Toggle
(function() {
  const STORAGE_KEY = 'nxt-theme';
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  setTheme(getTheme());

  if (btn) {
    btn.addEventListener('click', () => {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }
})();

// Mobile Menu
(function() {
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');

  if (btn && menu) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', menu.classList.contains('open'));
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }
})();

// Table of Contents Generator
(function() {
  const tocContainer = document.getElementById('toc');
  if (!tocContainer) return;

  const content = document.querySelector('.post-content');
  if (!content) return;

  const headings = content.querySelectorAll('h2, h3');
  if (headings.length === 0) {
    tocContainer.closest('.toc-card').style.display = 'none';
    return;
  }

  const fragment = document.createDocumentFragment();
  headings.forEach((heading, idx) => {
    if (!heading.id) heading.id = 'heading-' + idx;

    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.textContent = heading.textContent;
    link.className = heading.tagName === 'H3' ? 'toc-h3' : '';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    fragment.appendChild(link);
  });

  tocContainer.appendChild(fragment);

  // Active TOC item on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocContainer.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        const active = tocContainer.querySelector(`a[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-80px 0px -70% 0px' });

  headings.forEach(h => observer.observe(h));
})();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Code block copy button
document.querySelectorAll('pre').forEach(pre => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  pre.parentNode.insertBefore(wrapper, pre);
  wrapper.appendChild(pre);

  const btn = document.createElement('button');
  btn.textContent = '복사';
  btn.style.cssText = `
    position: absolute; top: 10px; right: 10px;
    padding: 4px 10px; border-radius: 4px;
    background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3);
    color: #818cf8; font-size: 0.75rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    font-family: inherit;
  `;
  btn.addEventListener('click', () => {
    const code = pre.querySelector('code') || pre;
    navigator.clipboard.writeText(code.textContent).then(() => {
      btn.textContent = '복사됨!';
      btn.style.background = 'rgba(52,211,153,0.15)';
      btn.style.borderColor = 'rgba(52,211,153,0.3)';
      btn.style.color = '#34d399';
      setTimeout(() => {
        btn.textContent = '복사';
        btn.style.background = 'rgba(99,102,241,0.15)';
        btn.style.borderColor = 'rgba(99,102,241,0.3)';
        btn.style.color = '#818cf8';
      }, 2000);
    });
  });
  wrapper.appendChild(btn);
});
