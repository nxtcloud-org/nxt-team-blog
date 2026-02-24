---
---
(function () {
  var CONFIG = {
    clientId: "{{ site.github_oauth.client_id }}",
    clientSecret: "{{ site.github_oauth.client_secret }}",
    allowedUsers: {{ site.data.allowed_users.users | jsonify }},
    loginUrl: "{{ '/login/' | absolute_url }}",
    TOKEN_KEY: "nxt_gh_token",
    USER_KEY: "nxt_gh_user",
    CHECKED_AT_KEY: "nxt_checked_at",
    CACHE_MS: 3600000 // 1시간
  };

  var isLoginPage =
    window.location.pathname === "{{ '/login/' | relative_url }}" ||
    window.location.pathname === "{{ '/login/' | relative_url }}".replace(/\/$/, "");

  // 로그인 페이지는 인증 체크 건너뜀
  if (isLoginPage) return;

  // 콘텐츠 숨기기 (인증 전까지)
  document.documentElement.style.visibility = "hidden";

  function goToLogin() {
    var redirect = encodeURIComponent(window.location.href);
    window.location.replace(CONFIG.loginUrl + "?redirect=" + redirect);
  }

  function isAllowed(username) {
    if (!username) return false;
    var lower = username.toLowerCase();
    return CONFIG.allowedUsers.some(function (u) {
      return u.toLowerCase() === lower;
    });
  }

  function verifyTokenWithGitHub(token, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.github.com/user", true);
    xhr.setRequestHeader("Authorization", "token " + token);
    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(null, data.login);
        } catch (e) {
          callback(new Error("parse error"));
        }
      } else {
        callback(new Error("status " + xhr.status));
      }
    };
    xhr.onerror = function () { callback(new Error("network error")); };
    xhr.send();
  }

  function showPage() {
    document.documentElement.style.visibility = "";
  }

  var token = localStorage.getItem(CONFIG.TOKEN_KEY);
  var cachedUser = localStorage.getItem(CONFIG.USER_KEY);
  var checkedAt = parseInt(localStorage.getItem(CONFIG.CHECKED_AT_KEY) || "0", 10);

  if (!token) {
    goToLogin();
    return;
  }

  // 캐시가 유효하면 API 호출 생략
  if (cachedUser && Date.now() - checkedAt < CONFIG.CACHE_MS) {
    if (isAllowed(cachedUser)) {
      showPage();
    } else {
      localStorage.clear();
      goToLogin();
    }
    return;
  }

  // GitHub API로 토큰 검증
  verifyTokenWithGitHub(token, function (err, username) {
    if (err) {
      // 네트워크 오류면 캐시된 사용자로 폴백
      if (cachedUser && isAllowed(cachedUser)) {
        showPage();
      } else {
        goToLogin();
      }
      return;
    }

    if (isAllowed(username)) {
      localStorage.setItem(CONFIG.USER_KEY, username);
      localStorage.setItem(CONFIG.CHECKED_AT_KEY, Date.now().toString());
      showPage();
    } else {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
      localStorage.removeItem(CONFIG.CHECKED_AT_KEY);
      window.location.replace(CONFIG.loginUrl + "?reason=unauthorized");
    }
  });

  // 전역 로그아웃 함수
  window.nxtLogout = function () {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.CHECKED_AT_KEY);
    window.location.href = CONFIG.loginUrl;
  };
})();
