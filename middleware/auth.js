// 로그인 관련 미들웨어

// 모든 화면에서 로그인한 사람 정보(currentUser), 현재 주소, 알림 메시지(flash)를 쓸 수 있게 해 줘요
function loadUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;

  // flash: 한 번 보여 주고 사라지는 알림 ("등록했어요" 같은 토스트)
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) delete req.session.flash;
  next();
}

// 로그인 안 했으면 로그인 화면으로 보내요
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

module.exports = { loadUser, requireLogin };
