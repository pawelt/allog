// ==========================================================================================

$(startApp);

// ==========================================================================================

function startApp() {

  $.ajaxSetup({ timeout: srv.ajaxTimeout });

  var vMsgBox = new BvMsgBox({el: '.msgbox'});
  var vIndex = new BvIndex({el: '.reg-contents'});
  var vActions = new BvActions({el: '.reg-actions'});
  var vBreadcrumbs = new BvBreadcrumbs({el: '.reg-breadcrumbs'});
  var vItems = new BvItems({el: '.items-list'});
  var vFilters = new BvFilters({el: '.header-filters'});

  setupLayout();
  m_cache.init();
  m_keyboard.init();

  m_pubsub.listenToOnce(m_pubsub, 'cache:ready', m_router.init);
};

// ==========================================================================================

function setupLayout() {

  var $indexHeaders = $('.contents-headers');
  var $editor =       $('.contents-editor');
  var $breadcrumbs =  $('.reg-breadcrumbs');
  var $actions =      $('.reg-actions');
  var $items =        $('.reg-items');

  function adjustLayout() {
    var headersHeight = $indexHeaders.height();
    var headersTop = $indexHeaders.offset().top;
    $editor.offset({top: (headersTop + headersHeight + 10)});
    var bcHeight = $breadcrumbs.height();
    var bcTop = $breadcrumbs.offset().top;
    $actions.offset({top: (bcTop + bcHeight + 25)});
    $items.offset({top: (bcTop + bcHeight + 25)});
  }
  $(window).resize(function() { adjustLayout(); });
  m_pubsub.listenTo(m_pubsub, 'breadcrumbs:rendered', adjustLayout);
  m_pubsub.listenTo(m_pubsub, 'index-meta:rendered', adjustLayout);

  // this doesn't belong here...
  $('.rebuild-cache').on('click', function (evt) {
    evt.preventDefault();
    m_ajax.postJSON('/rebuild-cache', { itemUri: m_router.getCurrentUri() }).done(function (res) {
      console.log('DONE /rebuild-cache:', res);
      m_pubsub.listenToOnce(m_pubsub, 'cache:ready', function () {
        document.location.reload();
      });
      m_cache.init();
    }).fail(function (res) {
      console.log('FAIL /rebuild-cache:', res);
      m_pubsub.trigger('msgbox:error',  res.message.replace(/\n/g, '<br />'));
    });
  });

  adjustLayout();
}
