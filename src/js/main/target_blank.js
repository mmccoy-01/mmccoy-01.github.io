(function() {
  var links = document.links;
  for (var i = 0, linksLength = links.length; i < linksLength; i++) {
    var link = links[i];

    if (link.hostname && link.hostname !== window.location.hostname) {
      var rel = link.getAttribute('rel') || '';

      link.target = '_blank';

      if (!/(^|\s)noopener(\s|$)/.test(rel)) {
        rel += ' noopener';
      }

      if (!/(^|\s)noreferrer(\s|$)/.test(rel)) {
        rel += ' noreferrer';
      }

      link.setAttribute('rel', rel.trim());
    }
  }
})();
