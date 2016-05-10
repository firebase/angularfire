'use strict';
describe('$firebaseUtils', function () {
  var $utils, $timeout, $rootScope, $q, tick, testutils;

  var MOCK_DATA = {
    'a': {
      aString: 'alpha',
      aNumber: 1,
      aBoolean: false
    },
    'b': {
      aString: 'bravo',
      aNumber: 2,
      aBoolean: true
    },
    'c': {
      aString: 'charlie',
      aNumber: 3,
      aBoolean: true
    },
    'd': {
      aString: 'delta',
      aNumber: 4,
      aBoolean: true
    },
    'e': {
      aString: 'echo',
      aNumber: 5
    }
  };

  beforeEach(function () {
    module('firebase');
    module('testutils');
    inject(function (_$firebaseUtils_, _$timeout_, _$rootScope_, _$q_, _testutils_) {
      $utils = _$firebaseUtils_;
      $timeout = _$timeout_;
      $rootScope = _$rootScope_;
      $q = _$q_;
      testutils = _testutils_;

      tick = function (cb) {
        setTimeout(function() {
          $q.defer();
          $rootScope.$digest();
          cb && cb();
        }, 1000)
      };
    });
  });

  describe('#batch', function() {
    it('should return a function', function() {
      expect(typeof $utils.batch()).toBe('function');
    });

    it('should trigger function with arguments', function() {
      var spy = jasmine.createSpy();
      var b = $utils.batch(spy);
      b('foo', 'bar');

      $rootScope.$digest();

      expect(spy).toHaveBeenCalledWith('foo', 'bar');
    });

    it('should queue up requests until timeout', function() {
      var spy = jasmine.createSpy();
      var b = $utils.batch(spy);
      for(var i=0; i < 4; i++) {
        b(i);
      }

      expect(spy).not.toHaveBeenCalled();

      $rootScope.$digest();
      $timeout.flush();
      expect(spy.calls.count()).toBe(4);
    });

    it('should observe context', function() {
      var a = {}, b;
      var spy = jasmine.createSpy().and.callFake(function() {
        b = this;
      });
      $utils.batch(spy, a)();
      $rootScope.$digest();
      expect(spy).toHaveBeenCalled();
      expect(b).toBe(a);
    });
  });

  describe('#debounce', function(){
    it('should trigger function with arguments',function(){
      var spy = jasmine.createSpy();
      $utils.debounce(spy,10)('foo', 'bar');

      $timeout.flush();
      $rootScope.$digest();
      expect(spy).toHaveBeenCalledWith('foo', 'bar');
    });

    it('should only trigger once, with most recent arguments',function(){
      var spy = jasmine.createSpy();
      var fn =  $utils.debounce(spy,10);
      fn('foo', 'bar');
      fn('baz', 'biz');

      $timeout.flush();
      $rootScope.$digest();
      expect(spy.calls.count()).toBe(1);
      expect(spy).toHaveBeenCalledWith('baz', 'biz');
    });

    it('should only trigger once (timing corner case)',function(){
      var spy = jasmine.createSpy();
      var fn =  $utils.debounce(spy, null, 1, 2);
      fn('foo', 'bar');
      var start = Date.now();

      // block for 3ms without releasing
      while(Date.now() - start < 3){ }

      fn('bar', 'baz');
      fn('baz', 'biz');
      expect(spy).not.toHaveBeenCalled();

      $timeout.flush();
      $rootScope.$digest();
      expect(spy.calls.count()).toBe(1);
      expect(spy).toHaveBeenCalledWith('baz', 'biz');
    });
  });

  describe('#updateRec', function() {
    it('should return true if changes applied', function() {
      var rec = {};
      expect($utils.updateRec(rec, testutils.snap('foo'))).toBe(true);
    });

    it('should be false if no changes applied', function() {
      var rec = {foo: 'bar',  $id: 'foo', $priority: null};
      expect($utils.updateRec(rec, testutils.snap({foo: 'bar'}, 'foo'))).toBe(false);
    });

    it('should apply changes to record', function() {
      var rec = {foo: 'bar',  bar: 'foo', $id: 'foo', $priority: null};
      $utils.updateRec(rec, testutils.snap({bar: 'baz', baz: 'foo'}));
      expect(rec).toEqual({bar: 'baz', baz: 'foo', $id: 'foo', $priority: null})
    });

    it('should delete $value property if not a primitive',function(){
      var rec = {$id:'foo', $priority:null, $value:null };
      $utils.updateRec(rec, testutils.snap({bar: 'baz', baz:'foo'}));
      expect(rec).toEqual({bar: 'baz', baz: 'foo', $id: 'foo', $priority: null});
    });
  });

  describe('#scopeData',function(){
    it('$id, $priority, and $value are only private properties that get copied',function(){
      var data = {$id:'foo',$priority:'bar',$value:null,$private1:'baz',$private2:'foo'};
      expect($utils.scopeData(data)).toEqual({$id:'foo',$priority:'bar',$value:null});
    });

    it('all public properties will be copied',function(){
      var data = {$id:'foo',$priority:'bar',public1:'baz',public2:'test'};
      expect($utils.scopeData(data)).toEqual({$id:'foo',$priority:'bar',public1:'baz',public2:'test'});
    });

    it('$value will not be copied if public properties are present',function(){
      var data = {$id:'foo',$priority:'bar',$value:'noCopy',public1:'baz',public2:'test'};
      expect($utils.scopeData(data)).toEqual({$id:'foo',$priority:'bar',public1:'baz',public2:'test'});
    });
  });

  describe('#applyDefaults', function() {
    it('should return rec', function() {
      var rec = {foo: 'bar'};
      expect($utils.applyDefaults(rec), {bar: 'baz'}).toBe(rec);
    });

    it('should do nothing if no defaults exist', function() {
      var rec = {foo: 'bar'};
      $utils.applyDefaults(rec, null);
      expect(rec).toEqual({foo: 'bar'});
    });

    it('should add $$defaults if they exist', function() {
      var rec = {foo: 'foo',  bar: 'bar', $id: 'foo', $priority: null};
      var defaults = { baz: 'baz', bar: 'not_applied' };
      $utils.applyDefaults(rec, defaults);
      expect(rec).toEqual({foo: 'foo',  bar: 'bar', $id: 'foo', $priority: null, baz: 'baz'});
    });
  });

  describe('#toJSON', function() {
    it('should use toJSON if it exists', function() {
      var json = {json: true};
      var spy = jasmine.createSpy('toJSON').and.callFake(function() {
        return json;
      });
      var F = function() {};
      F.prototype.toJSON = spy;
      expect($utils.toJSON(new F())).toEqual(json);
      expect(spy).toHaveBeenCalled();
    });

    it('should use $value if found', function() {
      var json = {$value: 'foo'};
      expect($utils.toJSON(json)).toEqual({'.value': json.$value});
    });

    it('should set $priority if exists', function() {
      var json = {$value: 'foo', $priority: 0};
      expect($utils.toJSON(json)).toEqual({'.value': json.$value, '.priority': json.$priority});
    });

    it('should not set $priority if it is the only key', function() {
      var json = {$priority: true};
      expect($utils.toJSON(json)).toEqual({});
    });

    it('should remove any variables prefixed with $', function() {
      var json = {foo: 'bar', $foo: '$bar'};
      expect($utils.toJSON(json)).toEqual({foo: json.foo});
    });

    it('should remove any deeply nested variables prefixed with $', function() {
      var json = {
        arr: [[
            {$$hashKey: false, $key: 1, alpha: 'alpha', bravo: {$$private: '$$private', $key: '$key', bravo: 'bravo'}},
            {$$hashKey: false, $key: 1, alpha: 'alpha', bravo: {$$private: '$$private', $key: '$key', bravo: 'bravo'}}

        ], ["a", "b", {$$key: '$$key'}]],
        obj: {
          nest: {$$hashKey: false, $key: 1, alpha: 'alpha', bravo: {$$private: '$$private', $key: '$key', bravo: 'bravo'} }
        }
      };

      expect($utils.toJSON(json)).toEqual({
        arr: [[
          {alpha: 'alpha', bravo: {bravo: 'bravo'}},
          {alpha: 'alpha', bravo: {bravo: 'bravo'}}

        ], ["a", "b", {}]],
        obj: {
          nest: {alpha: 'alpha', bravo: {bravo: 'bravo'} }
        }
      });
    });

    it('should throw error if an invalid character in key', function() {
      expect(function() {
        $utils.toJSON({'foo.bar': 'foo.bar'});
      }).toThrowError(Error);
      expect(function() {
        $utils.toJSON({'foo$bar': 'foo.bar'});
      }).toThrowError(Error);
      expect(function() {
        $utils.toJSON({'foo#bar': 'foo.bar'});
      }).toThrowError(Error);
      expect(function() {
        $utils.toJSON({'foo[bar': 'foo.bar'});
      }).toThrowError(Error);
      expect(function() {
        $utils.toJSON({'foo]bar': 'foo.bar'});
      }).toThrowError(Error);
      expect(function() {
        $utils.toJSON({'foo/bar': 'foo.bar'});
      }).toThrowError(Error);
    });

    it('should throw error if undefined value', function() {
      expect(function() {
        var undef;
        $utils.toJSON({foo: 'bar', baz: undef});
      }).toThrowError(Error);
    });
  });

  describe('#getKey', function() {
    it('should return the key name given a DataSnapshot', function() {
      var snapshot = testutils.snap('data', 'foo');
      expect($utils.getKey(snapshot)).toEqual('foo');
    });
  });

  describe('#makeNodeResolver', function(){
    var deferred, callback;
    beforeEach(function(){
      deferred = jasmine.createSpyObj('promise',['resolve','reject']);
      callback = $utils.makeNodeResolver(deferred);
    });

    it('should return a function', function(){
      expect(callback).toBeA('function');
    });

    it('should reject the promise if the first argument is truthy', function(){
      var error = new Error('blah');
      callback(error);
      expect(deferred.reject).toHaveBeenCalledWith(error);
    });

    it('should reject the promise if the first argument is not null', function(){
      callback(false);
      expect(deferred.reject).toHaveBeenCalledWith(false);
    });

    it('should resolve the promise if the first argument is null', function(){
      var result = {data:'hello world'};
      callback(null,result);
      expect(deferred.resolve).toHaveBeenCalledWith(result);
    });

    it('should aggregate multiple arguments into an array', function(){
      var result1 = {data:'hello world!'};
      var result2 = {data:'howdy!'};
      callback(null,result1,result2);
      expect(deferred.resolve).toHaveBeenCalledWith([result1,result2]);
    });
  });

  describe('#doSet', function() {
    var ref;
    beforeEach(function() {
      ref = firebase.database().ref().child("angularfire");
    });

    it('returns a promise', function() {
      expect($utils.doSet(ref, null)).toBeAPromise();
    });

    it('resolves on success', function(done) {
      var whiteSpy = jasmine.createSpy('resolve');
      var blackSpy = jasmine.createSpy('reject');
      $utils.doSet(ref, {foo: 'bar'})
        .then(whiteSpy, blackSpy)
        .then(function () {
          expect(blackSpy).not.toHaveBeenCalled();
          expect(whiteSpy).toHaveBeenCalled();
          done();
        });

      tick();
    });

    it('saves the data', function(done) {
      $utils.doSet(ref, true);
      ref.once("value", function (ss) {
        expect(ss.val()).toBe(true);
        done();
      });
    });

    it('rejects promise when fails', function(done) {
      var whiteSpy = jasmine.createSpy('resolve');
      var blackSpy = jasmine.createSpy('reject');
      $utils.doSet(ref, {"zippo/pippo": 'bar'})
        .then(whiteSpy, blackSpy)
        .finally(function () {
          expect(whiteSpy).not.toHaveBeenCalled();
          expect(blackSpy).toHaveBeenCalled();
          done();
        });

      tick();
    });

    it('only affects query keys when using a query', function(done) {
      ref.set({fish: true});
      var query = ref.limitToLast(1);
      var spy = spyOn(firebase.database.Reference.prototype, 'update').and.callThrough();

      $utils.doSet(query, {hello: 'world'});

      tick(function () {
        var args = spy.calls.mostRecent().args[0];
        expect(Object.keys(args)).toEqual(['hello', 'fish']);
        done();
      });
    });
  });

  describe('#doRemove', function() {
    var ref;
    beforeEach(function() {
      ref = firebase.database().ref().child("angularfire");
    });

    it('returns a promise', function() {
      expect($utils.doRemove(ref)).toBeAPromise();
    });

    it('resolves if successful', function(done) {
      var whiteSpy = jasmine.createSpy('resolve');
      var blackSpy = jasmine.createSpy('reject');
      $utils.doRemove(ref)
        .then(whiteSpy, blackSpy)
        .then(function () {
          expect(blackSpy).not.toHaveBeenCalled();
          expect(whiteSpy).toHaveBeenCalled();
          done();
        });

      tick();
    });

    it('removes the data', function(done) {
      $utils.doRemove(ref)
        .then(function () {
          ref.once("value", function (ss) {
            expect(ss.val()).toBe(null);
          });
          done();
        });

      tick();
    });

    it('rejects promise if write fails', function(done) {
      var whiteSpy = jasmine.createSpy('resolve');
      var blackSpy = jasmine.createSpy('reject');
      var err = new Error('test_fail_remove');

      spyOn(firebase.database.Reference.prototype, "remove").and.callFake(function (cb) {
        cb(err);
      });

      $utils.doRemove(ref)
        .then(whiteSpy, blackSpy)
        .then(function () {
          expect(whiteSpy).not.toHaveBeenCalled();
          expect(blackSpy).toHaveBeenCalledWith(err);
          done();
        });

      tick();
    });

    it('only removes keys in query when query is used', function(done) {
      ref.set(MOCK_DATA);

      var query = ref.limitToFirst(2);

      $utils.doRemove(query)
        .then(function () {
          ref.once("value", function (ss) {
            var val = ss.val();

            expect(val.a).not.toBeDefined();
            expect(val.b).not.toBeDefined();
            expect(val.c).toBeDefined();
            expect(val.d).toBeDefined();
            expect(val.e).toBeDefined();
            done();
          });
        });

      tick();
    });

    it('waits to resolve promise until data is actually deleted', function(done){
      ref.set(MOCK_DATA);
      var query = ref.limitToFirst(2);
      var deleted = false;

      query.on("value", function (ss) {
        var val = ss.val();
        deleted = !(val && (val.a || val.b));
      });

      $utils.doRemove(query).then(function(){
        expect(deleted).toBe(true);
        done();
      });

      tick();
    });
  });

  describe('#VERSION', function() {
    it('should return the version number', function() {
      expect($utils.VERSION).toEqual('0.0.0');
    });
  });
});

describe('#promise (ES6 Polyfill)', function(){

  var status, result, reason, tick, $utils, $timeout, $q, $rootScope;

  function wrapPromise(promise){
    promise.then(function(_result){
      status = 'resolved';
      result = _result;
    },function(_reason){
      status = 'rejected';
      reason = _reason;
    });
  }

  beforeEach(function(){
    status = 'pending';
    result = null;
    reason = null;
  });

  beforeEach(module('firebase',function($provide){
    $provide.decorator('$q',function($delegate){
      //Forces polyfil even if we are testing against angular 1.3.x
      return {
        defer:$delegate.defer,
        all:$delegate.all
      }
    });
  }));

  beforeEach(inject(function(_$firebaseUtils_, _$timeout_, _$q_, _$rootScope_){
    $utils = _$firebaseUtils_;
    $timeout = _$timeout_;
    $q = _$q_;
    $rootScope = _$rootScope_;

    tick = function (cb) {
      setTimeout(function() {
        $q.defer();
        $rootScope.$digest();
        cb && cb();
      }, 1000)
    };
  }));

  it('throws an error if not called with a function',function(){
    expect(function(){
      $utils.promise();
    }).toThrow();
    expect(function(){
      $utils.promise({});
    }).toThrow();
  });

  it('calling resolve will resolve the promise with the provided result',function(done){
    wrapPromise(new $utils.promise(function(resolve,reject){
      resolve('foo');
    }));

    tick(function () {
      expect(status).toBe('resolved');
      expect(result).toBe('foo');
      done();
    });
  });

  it('calling reject will reject the promise with the provided reason',function(done){
    wrapPromise(new $utils.promise(function(resolve,reject){
      reject('bar');
    }));

    tick(function () {
      expect(status).toBe('rejected');
      expect(reason).toBe('bar');
      done();
    });
  });

});
