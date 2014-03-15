var MAX_HISTORY_ITEMS = 50;

var app = angular.module('SeeApp', ['ngResource'], function($locationProvider) {
  $locationProvider.html5Mode(true);
});

app.controller('SeeCtrl', ['$scope', '$location', '$resource',
    function ($scope, $location, $resource) {
  var img = $location.search()['img'];
  if (img) {
    var parts = img.split('-');
    if (parts.length == 3) {
      var base_hash = parts[0];
      var gen_id = parts[1];
      var extension = parts[2];
      $scope['base_hash'] = base_hash;
      $scope['gen_id'] = gen_id;
      $scope['data'] = $resource('/data/image/' + base_hash + '/' + gen_id).get();
      if (window.localStorage) {
        var history = JSON.parse(window.localStorage.getItem('maxstagram')) || [];
        $scope['history'] = history;
      }
    }
  }

  // When data for an image is loaded and deemed valid,
  // save the base_hash in browser localstorage
  $scope.$watchCollection('data', function (data) {
    if (!data || !data.$resolved || !data.generated) return;
    if (window.localStorage) {
      var history = JSON.parse(window.localStorage.getItem('maxstagram')) || [];
      for (var i = 0; i < history.length; i++)
        if (history[i].base_hash === base_hash && history[i].gen_id === gen_id)
          return;
      history.splice(0, 0, {
        base_hash: base_hash,
        gen_id: gen_id,
        name: data.name,
      });
      history = history.slice(0, MAX_HISTORY_ITEMS);
      window.localStorage.setItem('maxstagram', JSON.stringify(history));
    }
  });

  // Erase history if needed
  $scope['zap_history'] = function() {
    window.localStorage.setItem('maxstagram', null);
    $scope['history'] = [];
  }
}]);

app.filter('formatParams', function() {
  return function(input) {
    if (!input || !input.length) return;
    var output = [];
    for (var i = 0; i < input.length; i++)
      if (input[i][0] == '-' || input[i][0] == '+' || !output.length)
        output.push(input[i]);
      else
        output[output.length-1] += ' ' + input[i];
    return output.join('\n');
  }
})
