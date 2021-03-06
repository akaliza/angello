var myModule = angular.module('Angello', ['ngRoute', 'ngAnimate', 'firebase']);

myModule.config(function ($routeProvider) {
    var getCurrentUser = function (AuthService, $location) {
        return AuthService.getCurrentUser().then(function (user) {
            if (!user) $location.path('/login');
        });
    };

    $routeProvider.
        when('/', {
            templateUrl: 'views/storyboard.html',
            controller: 'StoryboardCtrl',
            resolve: {
                currentUser: getCurrentUser
            }
        }).
        when('/dashboard', {
            templateUrl: 'views/dashboard.html',
            controller: 'DashboardCtrl',
            resolve: {
                currentUser: getCurrentUser
            }
        }).
        when('/users', {
            templateUrl: 'views/users.html',
            controller: 'UsersCtrl',
            resolve: {
                currentUser: getCurrentUser
            }
        }).
        when('/users/:userId', {
            templateUrl: 'views/user.html',
            controller: 'UserCtrl',
            resolve: {
                currentUser: getCurrentUser,
                user: function ($route, UsersService) {
                    var userId = $route.current.params.userId;
                    return UsersService.fetch(userId);
                },
                stories: function (StoriesService) {
                    return StoriesService.find();
                }
            }
        }).
        when('/login', {templateUrl: 'views/login.html', controller: 'LoginCtrl'}).
        otherwise({redirectTo: '/'});
});

myModule.run(function ($rootScope, LoadingService) {
    $rootScope.$on('$routeChangeStart', function (e, curr, prev) {
        if (curr.$$route && curr.$$route.resolve) {
            LoadingService.setLoading(true);
        }
    });

    $rootScope.$on('$routeChangeSuccess', function (e, curr, prev) {
        LoadingService.setLoading(false);
    });
});

myModule.constant('ENDPOINT_URI', 'https://angello.firebaseio.com/');

myModule.constant('Firebase', window.Firebase);

myModule.value('STORY_STATUSES', [
    {name: 'To Do'},
    {name: 'In Progress'},
    {name: 'Code Review'},
    {name: 'QA Review'},
    {name: 'Verified'}
]);

myModule.value('STORY_TYPES', [
    {name: 'Feature'},
    {name: 'Enhancement'},
    {name: 'Bug'},
    {name: 'Spike'}
]);

myModule.factory('AuthService', ['$rootScope', 'LoadingService', '$firebaseSimpleLogin', 'ENDPOINT_URI',
    function ($rootScope, LoadingService, $firebaseSimpleLogin, ENDPOINT_URI) {
        var $scope = $rootScope.$new(false);
        $scope.user = null;
        $scope.loginService = $firebaseSimpleLogin(new Firebase(ENDPOINT_URI));

        var getCurrentUser = function () {
            return $scope.loginService.$getCurrentUser();
        };

        var login = function (email, password) {
            LoadingService.setLoading(true);

            $scope.loginService.$login('password', { email: email, password: password });
        };

        var logout = function () {
            LoadingService.setLoading(true);

            $scope.loginService.$logout();
        };

        var register = function (email, password) {
            LoadingService.setLoading(true);

            $scope.loginService.$createUser(email, password);
        };

        var changePassword = function (email, oldPassword, newPassword) {
            LoadingService.setLoading(true);

            $scope.loginService.changePassword(email, oldPassword, newPassword);
        };

        var user = function () {
            return $scope.user;
        };

        var existy = function (x) {
            return x != null;
        };

        var userExists = function () {
            return existy($scope.user) && existy($scope.user.id);
        };

        var getCurrentUserId = function () {
            return userExists() ? $scope.user.id : null;
        };

        $rootScope.$on('$firebaseSimpleLogin:login', function (e, user) {
            $scope.user = user;
            LoadingService.setLoading(false);
            $rootScope.$broadcast('onLogin');
        });

        $rootScope.$on('$firebaseSimpleLogin:logout', function (e) {
            $scope.user = null;
            LoadingService.setLoading(false);
            $rootScope.$broadcast('onLogout');
        });

        $rootScope.$on('$firebaseSimpleLogin:error', function (e, err) {
            $scope.user = null;
            LoadingService.setLoading(false);
            $rootScope.$broadcast('onLogout');
        });

        return {
            getCurrentUser: getCurrentUser,
            getCurrentUserId: getCurrentUserId,
            user: user,
            login: login,
            logout: logout,
            register: register,
            changePassword: changePassword
        }
    }]);

myModule.factory('LoadingService', ['$rootScope',
    function ($rootScope) {
        var setLoading = function (loading) {
            $rootScope.loadingView = loading;
        };

        return {
            setLoading: setLoading
        }
    }]);

myModule.factory('StoriesService', ['$http', '$q', 'AuthService', 'ENDPOINT_URI',
    function ($http, $q, AuthService, ENDPOINT_URI) {
        var find = function () {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/stories.json';

            $http.get(url).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        var fetch = function (story_id) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/stories/' + story_id + '.json';

            $http.get(url).success(deferred.resolve).error(deferred.reject)

            return deferred.promise;
        };

        var create = function (story) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/stories.json';

            $http.post(url, story).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        var update = function (story_id, story) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/stories/' + story_id + '.json';

            $http.put(url, story).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        var destroy = function (story_id) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/stories/' + story_id + '.json';

            $http.delete(url).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        return {
            find: find,
            fetch: fetch,
            create: create,
            update: update,
            destroy: destroy
        };
    }]);

myModule.controller('UserCtrl', ['$scope', '$routeParams', 'user', 'stories',
    function ($scope, $routeParams, user, stories) {
        $scope.userId = $routeParams['userId'];
        $scope.user = user;

        $scope.getAssignedStories = function (userId, stories) {
            var assignedStories = {};
            var keys = Object.keys(stories);
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];
                if (stories[key].assignee == userId) assignedStories[key] = stories[key];
            }
            return assignedStories;
        };

        $scope.stories = $scope.getAssignedStories($scope.userId, stories);
    }]);

myModule.controller('MainCtrl', ['$scope', '$location', 'AuthService',
    function ($scope, $location, AuthService) {
        $scope.currentUser = null;

        $scope.logout = function () {
            AuthService.logout();
        };

        $scope.$on('onLogin', function () {
            $scope.currentUser = AuthService.user();
        });

        $scope.$on('onLogout', function () {
            $scope.currentUser = null;
            $location.path('login');
        });

        AuthService.getCurrentUser();
    }]);

myModule.controller('LoginCtrl', ['$scope', '$location', 'AuthService',
    function ($scope, $location, AuthService) {
        $scope.user = {
            email: '',
            password: '',
            register: false
        };

        $scope.submit = function (email, password, register) {
            if ($scope.loginForm.$valid) {
                ((register) ? AuthService.register : AuthService.login)(email, password);
                $scope.reset();
            }
        };

        $scope.reset = function () {
            $scope.user = {
                email: '',
                password: '',
                register: false
            };
        };

        $scope.$on('$firebaseSimpleLogin:login', function (e, user) {
            $location.path('/');
        });

        $scope.$on('$firebaseSimpleLogin:error', function (e, err) {
            console.log('ERROR', err);
        });
    }]);

myModule.controller('UsersCtrl', ['$scope', 'UsersService', function ($scope, UsersService) {
    $scope.newUser = { name: '', email: '' };
    $scope.users = {};

    $scope.getUsers = function () {
        UsersService.find().then(function (result) {
            $scope.users = (result !== 'null') ? result : {};
        }, function (reason) {
            console.log('ERROR', reason);
        });
    };

    $scope.addUser = function () {
        UsersService.create(angular.copy($scope.newUser)).then(function (result) {
            $scope.getUsers();
            $scope.newUser = { name: '', email: '' };
        }, function (reason) {
            console.log('ERROR', reason);
        });
    };

    $scope.updateUser = function (id, user) {
        UsersService.update(id, user).then(function (result) {
            // console.log('RESULT', result);
        }, function (reason) {
            console.log('ERROR', reason);
        });
    };

    $scope.removeUser = function (id) {
        UsersService.destroy(id).then(function (result) {
            $scope.getUsers();
        }, function (reason) {
            console.log('ERROR', reason);
        });
    };

    $scope.getUsers();
}]);

myModule.factory('UsersService', ['$http', '$q', 'AuthService', 'ENDPOINT_URI',
    function ($http, $q, AuthService, ENDPOINT_URI) {
        var find = function () {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/users.json';

            $http.get(url).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        var fetch = function (user_id) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/users/' + user_id + '.json';

            $http.get(url).success(deferred.resolve).error(deferred.reject)

            return deferred.promise;
        };

        var create = function (user) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/users.json';

            $http.post(url, user).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        var update = function (user_id, user) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/users/' + user_id + '.json';

            $http.put(url, user).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        var destroy = function (user_id) {
            var deferred = $q.defer();
            var url = ENDPOINT_URI + 'clients/' + AuthService.getCurrentUserId() + '/users/' + user_id + '.json';

            $http.delete(url).success(deferred.resolve).error(deferred.reject);

            return deferred.promise;
        };

        return {
            find: find,
            fetch: fetch,
            create: create,
            update: update,
            destroy: destroy
        };
    }]);


myModule.controller('StoryboardCtrl', ['$scope', 'StoriesService', 'UsersService', 'STORY_STATUSES', 'STORY_TYPES',
    function ($scope, StoriesService, UsersService, STORY_STATUSES, STORY_TYPES) {
        $scope.detailsVisible = true;
        $scope.currentStoryId = null;
        $scope.currentStory = null;
        $scope.editedStory = {};
        $scope.stories = [];

        $scope.types = STORY_TYPES;
        $scope.statuses = STORY_STATUSES;

        $scope.users = {};

        UsersService.find().then(function (result) {
            $scope.users = (result !== 'null') ? result : {};
        }, function (reason) {
            console.log('ERROR', reason);
        });


        $scope.setCurrentStory = function (id, story) {
            $scope.currentStoryId = id;
            $scope.currentStory = story;
            $scope.editedStory = angular.copy($scope.currentStory);
        };

        $scope.getStories = function () {
            StoriesService.find().then(function (result) {
                $scope.stories = (result !== 'null') ? result : {};
            }, function (reason) {
                console.log('ERROR', reason);
            });
        };

        $scope.createStory = function () {
            StoriesService.create($scope.editedStory).then(function (result) {
                $scope.getStories();
                $scope.resetForm();
            }, function (reason) {
                console.log('ERROR', reason);
            });
        };

        $scope.updateStory = function () {
            var fields = ['title', 'description', 'criteria', 'status', 'type', 'reporter', 'assignee'];

            fields.forEach(function (field) {
                $scope.currentStory[field] = $scope.editedStory[field]
            });

            StoriesService.update($scope.currentStoryId, $scope.editedStory).then(function (result) {
                $scope.getStories();
                $scope.resetForm();
            }, function (reason) {
                console.log('ERROR', reason);
            });
        };

        $scope.updateCancel = function () {
            $scope.resetForm();
        };

        $scope.resetForm = function () {
            $scope.currentStory = null;
            $scope.editedStory = {};

            $scope.detailsForm.$setPristine();
        };

        $scope.setDetailsVisible = function (visible) {
            $scope.detailsVisible = visible;
        };

        $scope.storiesWithStatus = function (status) {
            var stories = {};
            var keys = Object.keys($scope.stories);
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];
                if ($scope.stories[key].status == status.name) stories[key] = $scope.stories[key];
            }
            return stories;
        };

        $scope.$on('storyDeleted', function () {
            $scope.getStories();
            $scope.resetForm();
        });

        $scope.getStories();
    }]);

myModule.controller('DashboardCtrl', ['$scope', 'StoriesService', 'STORY_STATUSES', 'STORY_TYPES',
    function ($scope, StoriesService, STORY_STATUSES, STORY_TYPES) {
        $scope.types = STORY_TYPES;
        $scope.statuses = STORY_STATUSES;
        $scope.stories = [];

        StoriesService.find().then(function (stories) {
            var arr = [];
            for (var key in stories) {
                arr.push(stories[key]);
            }
            $scope.stories = arr;
        });
    }]);

myModule.directive('userstory', ['$rootScope', 'StoriesService', function ($rootScope, StoriesService) {
    var linker = function (scope, element, attrs) {
        element
            .mouseover(function () {
                element.css({ 'opacity': 0.9 });
            })
            .mouseout(function () {
                element.css({ 'opacity': 1.0 })
            });
    };

    var controller = function ($scope) {
        $scope.deleteStory = function (id) {
            StoriesService.destroy(id).then(function (result) {
                $rootScope.$broadcast('storyDeleted');
            }, function (reason) {
                console.log('ERROR', reason);
            });
        };
    };

    return {
        restrict: 'A',
        controller: controller,
        link: linker
    };
}]);

myModule.directive('sortable', ['StoriesService', function (StoriesService) {
    var linker = function (scope, element, attrs) {
        var status = scope.status.name;

        element.sortable({
            items: 'li',
            connectWith: ".list",
            receive: function (event, ui) {
                var prevScope = angular.element(ui.item.prev()).scope();
                var curScope = angular.element(ui.item).scope();

                scope.$apply(function () {
                    // TODO Fix the entire drag and drop to order mechanism
                    // StoriesService.insertStoryAfter(curScope.story, prevScope.story);
                    // curScope.story.status = status; // Update the status
                });
            }
        });
    };

    return {
        restrict: 'A',
        link: linker
    };
}]);

myModule.directive('chart', [function () {
    var parseDataForCharts = function (sourceArray, sourceProp, referenceArray, referenceProp) {
        var data = [];
        referenceArray.each(function (r) {
            var count = sourceArray.count(function (s) {
                return s[sourceProp] == r[referenceProp];
            });
            data.push([r[referenceProp], count]);
        });
        return data;
    };

    var linker = function (scope, element, attrs) {
        scope.$watch('sourceArray', function () {
            scope.data = parseDataForCharts(scope.sourceArray, attrs['sourceProp'], scope.referenceArray, attrs['referenceProp']);

            if (element.is(':visible')) {
                $.plot(element, [ scope.data ], {
                    series: {
                        bars: {
                            show: true,
                            barWidth: 0.6,
                            align: "center"
                        }
                    },
                    xaxis: {
                        mode: "categories",
                        tickLength: 0
                    }
                });
            }
        });
    };

    return {
        restrict: 'A',
        link: linker,
        scope: {
            sourceArray: '=',
            referenceArray: '='
        }
    };
}]);

myModule.animation('.list-area-expanded', [function () {
    return {
        addClass: function (element, className, done) {
            if (className == 'list-area-expanded') {
                TweenMax.to(element, 0.5, {right: 68, onComplete: done });
            }
            else {
                done();
            }
        },
        removeClass: function (element, className, done) {
            if (className == 'list-area-expanded') {
                TweenMax.to(element, 0.5, {right: 250, onComplete: done });
            }
            else {
                done();
            }
        }
    };
}]);

myModule.animation('.details-animation', [function () {
    return {
        addClass: function (element, className, done) {
            if (className == 'details-visible') {
                TweenMax.to(element, 0.5, {right: 0, onComplete: done });
            }
            else {
                done();
            }
        },
        removeClass: function (element, className, done) {
            if (className == 'details-visible') {
                TweenMax.to(element, 0.5, {right: -element.width() + 50, onComplete: done });
            }
            else {
                done();
            }
        }
    };
}]);
