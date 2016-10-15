//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
// 持有全局对象
  var root = this;

  // Save the previous value of the `_` variable.
// 持有之前的_
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
// 原型别名
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
// 常用方法别名
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
// ES5原生方法别名
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
// 生孩子方法需要用到的那个空构造方法
// 没必要放在全局，其它地方没用过，除了beget
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
// 用来支持链式调用，这样下面所有方法都作为静态方法存在
  var _ = function(obj) {
    // 链没断就直接返回
    if (obj instanceof _) return obj;
    // 链断了就重新包一个续上
    if (!(this instanceof _)) return new _(obj);
    // 持有被包裹的对象
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
// 把underscore挂在 root._ 上
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
// 针对ctx的优化，类似于currying
  var optimizeCb = function(func, context, argCount) {
// 没有ctx就直接返回func
    if (context === void 0) return func;
// 不传第3个参数就默认是3
    switch (argCount == null ? 3 : argCount) {
// 确定单参
      case 1: return function(value) {
        return func.call(context, value);
      };
// 确定2参，value、other
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
// 默认3参，item、index、arr
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
// 确定4参，收集器、item、index、arr
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
// >4参，用apply
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
// 很有用的回调生成方法，很多公开方法都是在cb的基础上实现的
  var cb = function(value, context, argCount) {
// 第1个参数为空，就返回一个管子方法，x => x
    if (value == null) return _.identity;
// 第一个参数是函数，就返回currying过的callback
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
// 第一个参数是对象，就返回一个属性检测器 (value, attrs) => value是不是attrs的超集（示例属性上有一份attrs，键值一摸一样）
    if (_.isObject(value)) return _.matcher(value);
// 默认返回取值方法，把value作为key 返回obj => obj[key]
    return _.property(value);
  };
  _.iteratee = function(value, context) {
// 返回一个callback，见cb中的四种情况，可以作用于集合中的每个元素
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
// 浅复制
// 返回一个用来复制属性及值的方法 copy(tar, source1, source2...)
// keysFunc表示取key的方法，undefinedOnly表示是否只复制不存在的属性
// 用于支持extend
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      // 跳过第一个，obj，遍历后面传入的
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        // 复制一份
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          // 浅复制，没有处理引用属性
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
// 生孩子方法，返回一个实例属性干净的对象，遗传信息作为原型属性
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    // es5自带的生孩子方法
    if (nativeCreate) return nativeCreate(prototype);
    // 否则用老的生孩子方法
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

// 返回取值方法（指定属性的getter）
  var property = function(key) {
    return function(obj) {
      // 取值并返回，obj为undefined/null就返回undefined
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
// 类型判断，是不是类数组（length属性为一个不太大的数字就算）
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
// 遍历，支持类数组（arguments）和对象
  _.each = _.forEach = function(obj, iteratee, context) {
    // currying绑定ctx
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
// 类数组直接 item, index, arr
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
// 否则当作对象处理 value, key, obj
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
// 映射 y=f(x)
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    // 兼容类数组结构
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);  // 创建结果集合
    // 填充
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      // y=f(x)
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
// 支持左右归约
  // dir只能取1或-1，-1表示从右边开始
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
// callback(prev, next, index, arr)
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      // 4值回调 收集器、item、index、arr
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
// 归约开始的基础值，没有就按归约方向取第一个值
        memo = obj[keys ? keys[index] : index];
// 跳过第1个
        index += dir;
      }
      // 执行归约，返回收集结果
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
// 从左向右归约
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
// 从右向左归约
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
// 统一查找入口，包装数组查找和对象查找
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      // 数组查找
      key = _.findIndex(obj, predicate, context);
    } else {
      // 对象查找
      key = _.findKey(obj, predicate, context);
    }
// 找着了（key不是undef也不是-1），就返回值
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
// 过滤器，圈个子集,保留漏勺下面的
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    // 筛选规则，转换为callback(item, index, arr)
    predicate = cb(predicate, context);
// 遍历，筛选
    _.each(obj, function(value, index, list) {
      // 筛选true就丢到结果集
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
// 与过滤器相反，保留漏勺上面的
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
// 针对集合的检测，所有元素都满足条件才返回true
  _.every = _.all = function(obj, predicate, context) {
    // 判断条件，转换为callback(item, index, arr)
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    // 遍历判断，不满足立即return false
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
// 与every/all相反，任一元素满足条件就返回true
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
// 包含性检测
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    // 对象就取出所有实例属性值
    if (!isArrayLike(obj)) obj = _.values(obj);
    // 实例属性
// guard用来保证遍历查找一定会进行（如果obj数组非空的话）
// 因为fromIndex可以不是数字（是数组元素值），此时_.indexOf不会遍历obj，而是直接二分查找item的下标，取值比较
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
// 从fromIndex开始自左向右查找，返回是否找到
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
// 对集合中的每个元素执行method，依赖_.map
  _.invoke = function(obj, method) {
    // 取出其它参数，切掉obj和method
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
//! method也可以是每个元素上的方法名，比如_.invoke([1, 2, 3], 'toString')
      var func = isFunc ? method : value[method];
      // 返回映射后的y，如果f(x)不存在的话，直接y=undefined/null
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
// 从对象集合中取出指定属性值，形成新数组
// 类似于查表，取出某一列
  _.pluck = function(obj, key) {
    // 做映射y=prop(key)
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
// 从集合中筛选出含有指定键值对集合的元素
  _.where = function(obj, attrs) {
    // 先取出attrs的实例属性，再对obj进行超集检测留下包含这些属性的元素
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
// 类似于where，找出第一个含有指定键值对集合的元素
  _.findWhere = function(obj, attrs) {
    // 类似于where，以超集检测作为条件，从左向右查找，返回符合条件的第一个元素
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
// 找出最大的元素，相等元素，排在前面的大（对象不能保证顺序，按Object.keys顺序遍历，与环境有关）
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    // 没有传入值计算方法
    if (iteratee == null && obj != null) {
      // 普通对象转数组（取出所有实例属性值）
      obj = isArrayLike(obj) ? obj : _.values(obj);
      // 遍历，直接>运算比较（因为没有提供比大小的方法）
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
    // obj为null或者传入了值计算方法
      // 把比大小方法转换为callback(item, index, arr)
      iteratee = cb(iteratee, context);
      // 遍历（_.each会区分类数组和对象）
      _.each(obj, function(value, index, list) {
        // 算出元素对应的数值
        computed = iteratee(value, index, list);
        // 数值比较，记录较大的那个（两个Infinity无法用>运算比较，此时认为当前元素更大，替掉之前记录的）
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
// 找出最小的元素，相等元素，排在前面的小（对象不能保证顺序，按Object.keys顺序遍历，与环境有关）
// 实现方式与max完全相同
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
// 洗牌，用的是经典洗牌算法（随机索引交换，但只随机左边，而不是全都随机，是Fisher–Yates shuffle的一个版本）
  _.shuffle = function(obj) {
    // 普通对象转数组（取出所有实例属性值）
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    // 创建结果数组
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      // 获取随机索引，[0, index]的随机数
      rand = _.random(0, index);
      // 交换（t = a, a = b, b = t）
      // 因为有原数组，直接a = b, b = _a完成
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
// 从集合中随机取样
// 样本大小为n，n默认值为1，n为0返回空数组
// guard参数用来保证能够配合map使用（只返回单值，而不是map无法处理的数组形式）
  _.sample = function(obj, n, guard) {
    // 没传n或者希望guard
    if (n == null || guard) {
      // 普通对象转数组（取出所有实例属性）
      if (!isArrayLike(obj)) obj = _.values(obj);
      // 随机选择一个index，返回对应的值
      return obj[_.random(obj.length - 1)];
    }
// 洗牌，抽出前n张
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
// 按iteratee给定的衡量标准对集合元素排序
  _.sortBy = function(obj, iteratee, context) {
    // 转换为callback(item, index, arr)
    iteratee = cb(iteratee, context);
// 1.fx = (v, i, w)，做映射，计算每个元素的权值，并记录索引
// 2.原生sort方法排序，按权值升序排列，权值相等时保持原顺序
// 3.取出结果表的value列
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
// 认为undefined很大，升序的话，最终所有undefined都排在后面
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
// 内部方法，用来实现_.groupBy
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      // iteratee可以是string，返回obj => obj[key]
      // 是function就转成常规的callback(item, index, arr)
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        // 取值，或者算出groupBy的依据（如果iteratee是function）
        var key = iteratee(value, index, obj);
        // 参数：结果集，正在遍历的当前值，groupBy的依据
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
// 分组，输入集合和分组依据，输出分组后的集合（值为数组的对象）
// 把一组对象，按照指定的公共key或者自定义分组依据函数进行分组
// 例如把一组学生，按照年龄分组
  _.groupBy = group(function(result, value, key) {
    // 如果结果集中有key，直接push，否则创建个数组再push
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
// 建立索引，类似于分组（每组确定只有一个元素），确定key不会重复的话
// 例如把一组学生，按照身份证号建立索引
  _.indexBy = group(function(result, value, key) {
    // 因为key唯一，不用考虑创建数组
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
// 按key统计，类似于分组，但只统计各key元素的数量
  _.countBy = group(function(result, value, key) {
    // 计数
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
// 可迭代对象转数组
// 期望obj为数组、普通对象、类数组
  _.toArray = function(obj) {
    // 参数无意义（undefined, null, false等值没意义），返回[]
    if (!obj) return [];
    // 数组，直接slice复制一个
    if (_.isArray(obj)) return slice.call(obj);
    // 类数组，对元素做映射 fx = x
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    // 普通对象，取出所有实例属性值
    return _.values(obj);
  };

  // Return the number of elements in an object.
// 计算集合大小
  _.size = function(obj) {
    // 参数无意义，0
    if (obj == null) return 0;
    // 类数组直接返回length，否则返回其实例属性数目
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
// 考试，把集合分割成两部分，满足指定条件的元素放一边，不满足的放另一边
// 返回二维数组res[0]是及格线上边的，res[1]是下边的
  _.partition = function(obj, predicate, context) {
    // callback(item, index, arr)
    predicate = cb(predicate, context);
    // 两个结果集
    var pass = [], fail = [];
    // 遍历，判断是否满足条件，及格的放左边，不及格的放右边
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    // 返回二维数组
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
// 取首元
// guard用来保证能够配合_.map使用（不管n是几，都返回单一值）
// n默认为1，指定了n的话，取前n个元素
  _.first = _.head = _.take = function(array, n, guard) {
    // 第1个参数不能为空，否则返回undefined
    if (array == null) return void 0;
    // 没传n或者传了真值guard，取首元
    if (n == null || guard) return array[0];
    // 传了前2个参数，就取前n个元素，交由_.initial处理（切掉末尾的len - n个元素，也就是留下前n个元素）
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
// 切掉尾元
// guard同上
// n默认为1，指定了n的话，去掉末尾的n个元素
  _.initial = function(array, n, guard) {
//!! 没有做array检查，null/undefined会出错
    // 去掉末尾的n个元素 slice(0, len - n)，index从0到len - n - 1
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
// 取尾元
// guard同上
// n默认为1，指定了n的话，取后n个元素
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    // 取尾元
    if (n == null || guard) return array[array.length - 1];
    // 取后n个元素，_.rest(len -n)跳过前len - n个元素，取index从len - n开始的所有元素
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
// 跳过
// guard同上
// n默认为1，跳过前n个，取剩下的所有元素
  _.rest = _.tail = _.drop = function(array, n, guard) {
    // slice(n)取从n开始的所有元素
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
// 滤掉所有假值
  _.compact = function(array) {
    // 用fx=x过滤一遍，filter内部是隐式Bool转换，会被自动转换为false的都会被滤掉
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
// 扁平化
// 深度优先递归
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    // 从左向右遍历
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      // 当前值
      var value = input[i];
      // 当前值是数组/类数组就递归flatten
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        // 如果没有强制浅度扁平化，就递归处理
        if (!shallow) value = flatten(value, shallow, strict);
        // 把当前元素的子子孙孙并入结果集
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
      // 不是数组/类数组 且 不要求严格的话，直接添进去
      // 要求严格的话，就不要了（strict为真值就只对数组进行一维化，结果集不要非数组元素）
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
// 一维化（扁平化）
// shallow表示只取第一层，浅度一维化
  _.flatten = function(array, shallow) {
    // 不要求严格，结果集含有所有元素（包括非数组元素）
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
// 去掉指定值
// 要传多个参数，array后面的参数是要去掉的值，可以是值/数组（会自动一维化）
  _.without = function(array) {
// 留下array中独有的元素，也就是从array中去掉array后面的参数
// slice能保证基本值会被包装成数组，所以_.difference中用的是严格一维化
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
// 去重
// 如果数组有序，传入isSorted真值一次过
// 无序的话，实现方式是循环包含性检测，性能比字典法差很多
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    // isSorted不是布尔值的话，做3参支持处理
    // 把3个参数(array, iteratee, context)映射到4个参数对应位置上，isSorted为false
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    // 如果传了权值计算方法，包装成callback(item, index, arr)
    if (iteratee != null) iteratee = cb(iteratee, context);
    // 结果集和临时变量
    var result = [];
    var seen = [];
    // 遍历
    for (var i = 0, length = getLength(array); i < length; i++) {
      // 当前值、计算权值（没传权值计算方法的话，权值就是当前值）
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      // 有序就直接seen记录上一个值，一次过
      if (isSorted) {
        // i === 0或者上一个元素的权值不等于当前元素的权值，添进结果集
        if (!i || seen !== computed) result.push(value);
        // 更新状态
        seen = computed;
      } else if (iteratee) {
      // 无序，但传了权值计算方法的话
        // 如果seen集合里没有当前元素的权值，值添进结果集，权值添进seen集
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
      // 无序 且 没传权值计算方法 且结果集中不含当前值，添进去
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
// 求并集
// a1 并 a2 并 a3...
  _.union = function() {
    // 先浅度严格一维化，再去重，得到并集
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
// 求交集
// a1 交 a2 交 a3...
  _.intersection = function(array) {
    // 结果集，参数数量
    var result = [];
    var argsLength = arguments.length;
    // 遍历array
    // 包含性检测收集，类似于_.unique无序情况
    for (var i = 0, length = getLength(array); i < length; i++) {
      // 当前值
      var item = array[i];
      // 结果集中已经有了，跳过
      if (_.contains(result, item)) continue;
      // 遍历其余集合
      // 逐一进行包含性检测，如果发现任一集合中不存在当前值，提前结束遍历
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      // 如果把其它集合遍历完了（发现大家都含有当前值），纳入结果集
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
// diff一个数组和其它多个数组，留下第一个数组中独有的元素（其它多个数组中都没有这些元素）
// a1 - (a1 交 (a2 并 a3 并 a4...))
  _.difference = function(array) {
    // 跳过array，浅度严格一维化arguments，取出所有元素（其它多个数组）
    var rest = flatten(arguments, true, true, 1);
    // 对array进行fx=x !in rest过滤，留下array中独有的值
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
// 行列转置
// 把多个数组整理成一个数组，相同索引的元素放一起
// 直接调用_.unzip
// 二者结果一样，参数不同，_.zip接受n个1维数组，_.unzip接受1个2维数组
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
// 行列转置
// array是一个二维数组
  _.unzip = function(array) {
    // 取二维数组的最长元素的长度，默认为0
    var length = array && _.max(array, getLength).length || 0;
    // 创建结果集
    var result = Array(length);

    // 填充结果集
    for (var index = 0; index < length; index++) {
      // 结果集第n行 = 二维数组的第n列
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
// 数组转对象
// 单参[key, val]列表，或者2参keys, values
  _.object = function(list, values) {
    // 结果对象
    var result = {};
    // 遍历
    for (var i = 0, length = getLength(list); i < length; i++) {
      // 如果是2参
      if (values) {
        // 从keys取key, 从values取val，粘到结果对象上
        result[list[i]] = values[i];
      } else {
      // 如果是单参
        // 从列表的当前行取key和val，粘到结果对象上
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
// 数组查找，支持从左向右找和从右向左找
// 实现类似于左右归约
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      // 匹配规则函数，转换为callback(item, index, arr)
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
// 匹配就返回index
        if (predicate(array[index], index, array)) return index;
      }
// 都不匹配返回-1
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
// 从左向右查找
  _.findIndex = createPredicateIndexFinder(1);
// 从右向左查找
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
// 二分法找出元素应该被插入的位置，保持原顺序
  _.sortedIndex = function(array, obj, iteratee, context) {
    // 单参，callback(value)
    iteratee = cb(iteratee, context, 1);
    // 把obj转换成值，用于二分比较
    var value = iteratee(obj);
    // 二分查找
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
// 数组下标查找方法生成器
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    // 返回查找方法 f(arr, item, formIndex)
// idx可以是下标，也可以是值
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
        // 从左向右
// idx可以是[-len, 0)的负数，表示倒数第几个；对于(-infinity, -len)的，无效，重置为0
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
        // 从右向左
// 正数防止超过右边界
//! 负数也表示倒数第几个，但没有处理超出左边界情况（没必要+1，最后遍历时又-回来了，可能为了易读吧）
// 不用处理左边界，因为i--, i >= 0，超出左边界根本不会进循环
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
// 如果idx不是数字，可能是数组中的一个值，就找出它的下标（二分法查找）
        idx = sortedIndex(array, item);
        // 值相等就找到了
        return array[idx] === item ? idx : -1;
      }
      // 如果item是NaN，特殊处理
      if (item !== item) {
        // 把目标范围元素复制一份，在该子集中找一遍NaN（查找方向由findIndex和findLastIndex来定）
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        // 找到了就返回下标，否则-1
        return idx >= 0 ? idx + i : -1;
      }
      // 正常情况，在子集中查找
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
// 从左向右查找
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
// 从右向左查找
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
// 生成等差数列
// 3个参数类似于py的range，`pydoc range`
  _.range = function(start, stop, step) {
    // 如果没传stop
    if (stop == null) {
      // 把起点作为终点
      // 因为range(10, undefined, 2)没意义，直接按range(0， 10， 2)理解
      stop = start || 0;
      start = 0;
    }
    // step默认值为1
    step = step || 1;

    // 计算生成数组的长度
    var length = Math.max(Math.ceil((stop - start) / step), 0);
    // 创建结果数组
    var range = Array(length);

    // 填充，间隔为step
    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
// 模拟原生bind的执行机制
// 根据指定参数确定把一个函数当作构造器还是普通函数来执行
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    // 如果callingContext与boundFunc没有继承关系，直接用原context执行原函数
    // 即fn.bind().call(obj, args)的情况，与原生bind保持一致
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    // 否则，需要处理存在继承的情况
//? 有点复杂，日后再议
    // 用生孩子方法，获取干净的原型
    var self = baseCreate(sourceFunc.prototype);
    // 以原函数的原型为执行环境，执行原方法
    var result = sourceFunc.apply(self, args);
    // 如果结果是对象，返回执行结果
    if (_.isObject(result)) return result;
    // 否则返回干净原型
    //! 为了支持链式调用？
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
// bind的兼容方案
  _.bind = function(func, context) {
    // 如果原生支持bind且通过func能访问到原生bind，就直接用原生bind
    //! 实际上无法检测出有没有被篡改过
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    // 如果func不是函数，抛出异常
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    // 把func, context切掉
    var args = slice.call(arguments, 2);
    // 返回一个新函数
    var bound = function() {
      // bind执行
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
// 类似于currying，但提供了占位符
// 通过占位符可以跳着绑，比用bind实现的一般currying更强大
  _.partial = function(func) {
    // func后面的其它参数都是要绑定给func的
    var boundArgs = slice.call(arguments, 1);
    // currying结果
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        // 如果要绑定的参数为_（表示一个占位符，当然，也是underscore），就把新传入的参数填进去
        //! 例如_.partial((a, b, c, d) => console.log(a, b, c, d), 1, _, _, 4)(2, 3);
        // 否则不变，就用之前currying内定的参数值
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      // 如果新传入的参数有剩余（填完空还多余几个），就都放在参数列表最后
      while (position < arguments.length) args.push(arguments[position++]);
      // bind执行
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
// 批量bind
// 把对象上的多个方法绑定到另一个对象上，其余参数是需要绑定的方法名
// 在保证一个对象上的所有回调都属于该对象时很有用
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    // 无参检查
    if (length <= 1) throw new Error('bindAll must be passed function names');
    // 遍历obj后面的所有key
    for (i = 1; i < length; i++) {
      key = arguments[i];
      // 让obj的key方法中的this指向obj
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
// 缓存func计算结果
// 通过key来存取，不是很方便，参数判断存在函数不纯会出错的问题，用传入的key比较保险
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      // 取cache对象
      var cache = memoize.cache;
      // 传了hash计算方法的话，计算key，否则就用传入的key
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      // 查缓存表，没有的话，执行func，并缓存结果
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      // 有缓存就返回缓存结果
      return cache[address];
    };
    // 创建一个缓存表，key - value
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
// 延迟wait毫秒执行func，返回timeoutId
  _.delay = function(func, wait) {
    // 切掉func和wait，得到实际参数
    var args = slice.call(arguments, 2);
    // 延迟wait毫秒执行func，返回timeoutId
    return setTimeout(function(){
      // 执行func
      //! return没意义，没人能收到这个返回值
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
// nextTick，延迟1毫秒执行
// 实现很巧妙，通过_.partial给_.delay做currying，把func空出来，只绑定wait=1
// 此时_.defer(func)就等价于_.delay(func, 1)
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
// 节流方法
// 默认options={leading: true, trailing: true}，默认会执行多次（多段时间多次调用的话）
// leading=false表示只执行最后一次，trailing=false表示只执行第一次，多段时间多次调时一共只会执行1次
// 在给定时间段间隔内最多只执行一次（不管调用多少次）
// 也是经典的setTimeout实现
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    // options默认值{}
    if (!options) options = {};
    // 
    var later = function() {
      // 传了leading=false选项的话，不记录上一次执行func()的时间点
      previous = options.leading === false ? 0 : _.now();
      // 重置timeout
      timeout = null;
      // 执行func并记录结果
      result = func.apply(context, args);
      // 重置context和args
      if (!timeout) context = args = null;
    };
    return function() {
      // 去当前时间戳
      var now = _.now();
      // 没有上次执行时间，且leading选项为false，把当前时间作为上次执行时间
      if (!previous && options.leading === false) previous = now;
      // 计算到下次执行还需等待的时间
      var remaining = wait - (now - previous);
      // 记录ctx和参数
      context = this;
      args = arguments;
      // 如果不用等了，或者需要等待的时间比wait还大（上次调用到现在隔了好久了），立即执行func
      if (remaining <= 0 || remaining > wait) {
        // 如果存在延迟调用的话，取消掉
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        // 把当前时间作为上次执行时间
        previous = now;
        // 执行func
        result = func.apply(context, args);
        // 重置状态
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
      // 否则，如果不存在延迟调用 且 trailing选项不为false，延迟等待时间后执行later
        timeout = setTimeout(later, remaining);
      }
      // 返回上次执行结果（第一次返回本次执行结果）
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
// 保证函数只执行一次，多次调用不会反复执行
// 返回一个函数，只要它还在被持续调用，就不会触发。在停止调用该函数的wait毫秒后，函数才会执行
// 如果传了immediate真值，函数就在一开始调用，否则默认在最后调用
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      // 已经等待的时间
      var last = _.now() - timestamp;

      // 已等待时间小于wait 且 >=0
      if (last < wait && last >= 0) {
        // 延迟剩余等待时间再次判断
        timeout = setTimeout(later, wait - last);
      } else {
      // 已等待时间大于wait 或 <0（有可能吗？），立即执行
        timeout = null;
        // 如果没传immediate真值，立即执行
        // 传了的话表示func已经执行过了，在第一次调用时就执行了，这里不再执行
        if (!immediate) {
          result = func.apply(context, args);
          // 重置状态
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      // 持有ctx和参数列表
      context = this;
      args = arguments;
      // 记录当前时间戳
      timestamp = _.now();
      // 是否立即执行，leading
      var callNow = immediate && !timeout;
      // 弄个篮子，把之后的调用接着（无论是否callNow，都需要处理之后的调用）
      if (!timeout) timeout = setTimeout(later, wait);
      // 立即执行
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      // 返回值意义不大，因为返回值为undefined可能表示func执行了但没有返回值，或者func没执行
      // immediate的话，之后的调用都返回第一次执行的结果，否则之前的调用都返回undefined
      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
// 包裹方法，把func包起来
// 把func作为wrapper的参数，是一种简单的bind
// 这样就可以调整参数，在一段代码之前或之后执行，还可以选择性的执行原方法
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
// 取反，再包一层，对判断函数的返回值取反
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
// 从右向左管道
//! 为什么从后向前执行？为了好看？
//! 不是，因为符合f(g(h(x)))这样的调用习惯
//! console.log(_.compose(x => x + 1, x => x * 2, x => x - 1)(2));
// 把一系列函数组合成一个，每个都处理它前一个函数的返回值
  _.compose = function() {
    var args = arguments;
    // 从末尾开始
    var start = args.length - 1;
    return function() {
      // 从末尾开始
      var i = start;
      // 执行最后一个函数，并获取返回值
      var result = args[start].apply(this, arguments);
      // 连接管道
      while (i--) result = args[i].call(this, result);
      // 返回最终结果
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
// 第几次后执行
// 第times次调用时才会执行func，再之后的调用也会执行
  _.after = function(times, func) {
    return function() {
      // 剩余次数为0或负数才执行func
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
// 只执行几次
//! 只执行times-1次，为什么不包括第times次？搞得_.once()看着都难受
  _.before = function(times, func) {
    // 缓存返回值
    var memo;
    return function() {
      // 前times-1次调用
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      // 之后的调用忽略掉，直接返回最后一次执行结果
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
// 只执行1次
// _.before()的一种情况，对_.before做个currying
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
// [IE8-] bug，与不可枚举属性同名的实例属性也不可枚举，详细见
// http://stackoverflow.com/questions/3705383/ie8-bug-in-for-in-javascript-statement
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
// 不可枚举属性列表
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

// 把可能被不可枚举的原型属性掩盖的添进去
  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    // 没有原型的话，默认Object.prototype
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
// 特殊处理constructor
// 因为可能为了继承手动修改constructor属性，只要constructor是实例属性就考虑添进去
    var prop = 'constructor';
    // 是实例属性 && 现有keys里面没有该属性
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    // 遍历把可能被不可枚举的原型属性掩盖的添进去
    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      // 实例可访问该属性 && 实例属性值不等于原型属性值 && 现有keys里面没有该属性（跳过已经挑出来的）
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
// 取出对象的所有实例属性key
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    // 支持ES5 Object.keys()，直接用
    if (nativeKeys) return nativeKeys(obj);
    // 传统方法，遍历hasOwnProperty过滤
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    // 兼容[IE8-]，把可能被不可枚举的原型属性掩盖的添进去
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
// 获取对象的所有可枚举属性（for...in）
  _.allKeys = function(obj) {
    // 参数检查
    if (!_.isObject(obj)) return [];
    // 结果集
    var keys = [];
    // for...in遍历
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    // 兼容[IE8-]，同上
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
// 取出对象的所有实例属性值
  _.values = function(obj) {
    // 取出实例属性key
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    // 读取属性值形成集合 不过滤，因为_.keys()过滤过了
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
// 对象map
// 类似于数组的_.map()
  _.mapObject = function(obj, iteratee, context) {
    // 生成callback(value, key, obj)
    iteratee = cb(iteratee, context);
    // 取实例属性key
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
    // 做映射，fx=iteratee(x)
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
// 对象转key-value数组
  _.pairs = function(obj) {
    // 取实例属性key
    var keys = _.keys(obj);
    var length = keys.length;
    // 结果集
    var pairs = Array(length);
    // 填充[key, value]
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
// key-value反转
// value必须可序列化，没做任何额外处理，新key为value.toString()
  _.invert = function(obj) {
    // 结果集
    var result = {};
    // 取实例属性key
    var keys = _.keys(obj);
    // 填充result[value] = key
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
// 返回对象身上的所有方法名，并排序（字典序）
  _.functions = _.methods = function(obj) {
    // 结果集
    var names = [];
    // 填充，value是function的话，把key塞进去
    for (var key in obj) {
      // function检测用的是{}.toString.call(fn) === '[object Function]'
      if (_.isFunction(obj[key])) names.push(key);
    }
    // 原生排序，字典序
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
// 属性复制（可枚举属性）
// 把后面参数身上的所有实例属性全粘到第一个参数上
// createAssigner返回copy(tar, source1, source2...)
// 对每一个source用_.allKeys()取出所有可枚举属性，再循环取值粘到tar上
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
// 属性复制（实例属性）
// 实现方式同上
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
// 对象查找，返回第一个满足条件的元素的key
  _.findKey = function(obj, predicate, context) {
    // 包装callback(item, index, arr)
    predicate = cb(predicate, context);
    // 取出所有实例属性key
    var keys = _.keys(obj), key;
    // 从左向右，找出第一个满足条件的元素，返回对应的key
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
// 对象filter
// 留下oiteratee筛选返回真值的属性及值，滤掉剩下的
// oiteratee传入过滤规则函数，或者传入属性白名单数组（此时可以传多个，例如_.pick(obj, ['a'], ['b', 'c'])）
  _.pick = function(object, oiteratee, context) {
    // 结果集
    var result = {}, obj = object, iteratee, keys;
    // 参数检查
    if (obj == null) return result;
    // 如果过滤规则是函数
    if (_.isFunction(oiteratee)) {
      // 取出所有可枚举属性
      keys = _.allKeys(obj);
      // 生成callback(value, key, obj)
      iteratee = optimizeCb(oiteratee, context);
    } else {
    // 否则，可能是属性白名单数组
      // 对参数做浅度不严格一维化，从1开始（跳过object）
      keys = flatten(arguments, false, false, 1);
      // 生成过滤规则，滤掉obj上没有的key
      iteratee = function(value, key, obj) { return key in obj; };
      // 确保obj是对象类型（基本值会被Object包装）
      obj = Object(obj);
    }
    // 执行filter
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      // 留下通过过滤规则检测的
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
// 与pick相反，保留漏勺上面的
  _.omit = function(obj, iteratee, context) {
    // 函数取反
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
    // 生成相反的过滤规则
      // 先做浅度不严格一维化，再做fx=String(x)映射，保证key都是string
      var keys = _.map(flatten(arguments, false, false, 1), String);
      // 生成相反的过滤规则
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    // 利用pick
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
// 属性吸收（只抄自身没有的属性）
// 只从强化材料上复制自身不存在的属性（“不存在”检测是obj[key] === undefined）
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
// 继承
// 没有处理constructor，其它都好
  _.create = function(prototype, props) {
    // 用生孩子方法创建实例属性干净的原型对象
    var result = baseCreate(prototype);
    // 如果提供了额外属性props，都给粘上去作为实例属性
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
// 对象浅复制
  _.clone = function(obj) {
    // 不是对象的话，直接返回参数，因为值传递就是复制
    if (!_.isObject(obj)) return obj;
    // 是数组的话，直接slice()复制
    // 否则_.extend()粘到{}上，当然，只复制引用不复制引用指向的值，所以是浅复制
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
// 调用拦截器，然后返回该对象
// 用来支持链式调用
// 包装一层，让一个本来没有返回值的函数interceptor(obj)返回obj
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
// key-value包含性检测
// 检查对象是否包含指定的key-value集合，要求属性名和值都相等，但不要求必须是实例属性
  _.isMatch = function(object, attrs) {
    // 取实例属性key
    var keys = _.keys(attrs), length = keys.length;
    // undefined、null，只包含空集
    if (object == null) return !length;
// 用Object再包一遍，为了obj[key]不报错，把基本值装箱
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      // 当前key
      var key = keys[i];
      // 值不严格相等 或 不存在该属性（为了进一步排除attrs['a']为undefined, obj没有'a'属性的情况）
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
// 判断是否完全相同
// 用来支持_.isEqual()
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
// 0 === -0，但是它们不完全相同
//!! 候补的1 / a === 1 / b是为了区别很接近0的极小数，因为1e-1000 === 0
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    // 针对null和undefined，因为null == undefined
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    // 把被包装的东西拿出来，与下面的递归有关
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    // 比较内部属性[[Class]]
    var className = toString.call(a);
    // 类型不同，返回false
    if (className !== toString.call(b)) return false;
    
    // 对字符串、数字、正则表达式、日期对象、布尔值做值比较
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
// 正则表达式也有特殊的valueOf()，能返回字面量形式，例如'' + /a/i === '/a/i'
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
      // 字符串类似于正则表达式，'' + new String('5') === '5'
      // 这里认为基本值完全等价于其包装对象
      //! '' + new String(5) === '5'也成立，因为数字5转字符串后完全等价于'5'
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        // 处理NaN，一元+运算转数字，用来支持new Object(NaN) === NaN
        // NaN的定义就是与任何东西都不等，包括自身，所以判断是a !== a 且 b !== b
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        // 比较一般数字，a非常接近0的话（比如1e-1000），比较1/a和1/b，否则直接比较a和b
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // 日期对象和布尔值，直接取值比较
//! 两个不合法的日期对象都是NaN，此时认为它们不相等，比如+new Date('2016a3a3') === NaN
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    // 处理数组和对象
    var areArrays = className === '[object Array]';
    // 如果不是数组
    if (!areArrays) {
      // typeof检测，只要有一个不是'object'，就返回false
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
// 认为构造器不同的对象不完全相同，但认为来自不同frame的对象及数组是完全相同的
      // 取constructor属性
      var aCtor = a.constructor, bCtor = b.constructor;
      // 如果构造器不同，并且不满足下一个条件
      // 各自的构造器都是函数 且 构造器是构造器自身的实例
      // 并且各自都有'constructor'属性
      // 就返回false
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
// 对数组和对象做深度比较
// 广度优先遍历，套得最浅的元素最先被遍历到
    // 递归需要的历史栈
    aStack = aStack || [];
    bStack = bStack || [];
    // 嵌套深度
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
// 处理循环引用，如果历史栈里面有自身，就直接看对面这个位置是不是也是自身
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    // 把自身放在各自的栈底
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    // 处理数组
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      // 比较数组长度，看有没有必要做深度比较
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
// 深度比较数组值，忽略掉数组对象身上的非数字属性，因为通过length取不到
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
    // 处理对象
      // Deep compare objects.
      // 取出实例属性key
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      // 先看看两个对象的属性数相等不，不等的话就没必要深度比较了
      if (_.keys(b).length !== length) return false;
// 只对实例属性做深度比较
      while (length--) {
        // Deep compare each member
        key = keys[length];
        // 对面没有当前key或者二者的值不相等，返回false
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
// 看完一个吐一个
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
// 深度比较
// 检查两个对象是否相等，只检查实例属性，对整个结构做值比较，{a: {b: 1}} === {a: {b: 1}}
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
// 判空
  _.isEmpty = function(obj) {
    // undefined和null为空
    if (obj == null) return true;
    // 类数组的话，如果是数组 或者 字符串 或者 arguments对象，判断length是否为0
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    // 否则就当对象处理，判断实例属性数量是否为0
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
// DOM元素检测
//! 不一定准确，因为是obj.nodeType === 1检测
  _.isElement = function(obj) {
    // 真值 且 nodeType === 1
//! !!是为了把obj转布尔值，因为短路情况括号内值为obj，比如obj为NaN
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
// 数组检测
// 优先用ES5的Array.isArray，没有就用经典toString判断
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
// typeof判断，函数返回function，数组和普通对象返回object
// && !!obj是为了排除null，因为typeof null === 'object'
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
// 类型判断isXXX
// 用的是经典toString判断
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
// arguments对象判断，兼容[IE8-]
// 因为[IE8-]的内部属性[[Class]]没有'Arguments'这个值
  // 如果经典toString检测不认arguments对象，就用降级方案
  if (!_.isArguments(arguments)) {
// 如果对象具有实例属性'callee'，就认为它是arguments对象
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
// 函数判断，兼容老版本v8、IE11和Safari8
  // 浏览器hack
  // 如果typeof检测正则表达式不为'function' 且 typeof检测Int8Array不为'object'
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    // 重写函数判断，typeof检测返回'function'
//! || false是为了解决IE8 & 11下的一个诡异问题（有时typeof dom元素结果是'function'，|| false竟然能解决），见：
//! https://github.com/jashkenas/underscore/issues/1621
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
// 是不是有限数字
  _.isFinite = function(obj) {
    // 能过isFinite()检测 且 转浮点数后是个数字
//! 因为isFinite(null) === true，需要右边判断
//! undefined派生自null，但奇怪的是
//! isFinite(null) === true 但是 isFinite(undefined) === false
//! isNaN(null) === false 但是 isNaN(undefined) === true
//! 也就是说，js认为空（null）是一个有限数，认为未定义（undefined）不是个数，更不是有限的
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
// !number判断
  _.isNaN = function(obj) {
    // 是数字 且 自身不等于自身转数字（NaN的特性，与自身不等）
// isNumber是通过Object.prototype.toString判断的，定义在_.isObject下面
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
// 布尔值判断
  _.isBoolean = function(obj) {
    // 为true或false，或者是Boolean对象
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
// null判断
// 直接全等比较
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
// undefined判断
// 同上
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
// 是否含有指定实例属性
  _.has = function(obj, key) {
    // 不为undefined或null 且 具有名为key的实例属性
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
// 解决_冲突
  _.noConflict = function() {
    // 把 _ 还回去
    root._ = previousUnderscore;
    // 把自己交出去
    return this;
  };

  // Keep the identity function around for default iteratees.
// 管子 x => x
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
// 用于生成断言
// 例如 _.constant(value)() === value
  _.constant = function(value) {
    // 闭包持有value，如果是引用，可以从外部修改value，基本值的话，就是存了个常量
    return function() {
      return value;
    };
  };

// 啥也不做
// no operation，主要用于默认回调
  _.noop = function(){};

// 生成取值方法（指定属性的getter）
// _.property(key) 生成 obj => obj != null ? obj[key] : undefined
  _.property = property;

  // Generates a function for a given object that returns a given property.
// 为指定对象生成getter
// 与property主客相反 生成 key => obj != null ? obj[key] : undefined
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
// 返回一个判断方法，用来检测obj是不是给定键值对集合的超集
  _.matcher = _.matches = function(attrs) {
    // 取出attrs的实例属性
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      // 对传入obj做key-value包含性检测
      // 要求属性名和值都相等，但不要求必须是实例属性
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
// 把一个函数执行n次
// iteratee(nth)
// 返回n次执行的结果集
  _.times = function(n, iteratee, context) {
    // 结果集
    var accum = Array(Math.max(0, n));
    // 包装成callback(value)
    iteratee = optimizeCb(iteratee, context, 1);
    // 填充，把0 ~ n-1传入callback
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
// 生成[min, max]内的随机数
// max可选，单参表示[0, min]
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
// 返回当前时间戳，简单兼容处理
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  // 转义字典
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  // key-value反转，生成去转义字典
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  // 转义器
  // 根据传入字典做转义/去转义
  var createEscaper = function(map) {
    // 查字典
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    // 根据待转义项拼接生成匹配规则
    var source = '(?:' + _.keys(map).join('|') + ')';
    // 匹配正则，单次
    var testRegexp = RegExp(source);
    // 替换正则，多次
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      // 传入字符串检查，undefined/null转空串
      string = string == null ? '' : '' + string;
//! 性能优化
//! 先用匹配正则检查，存在需要转义的才上替换正则（匹配，查字典，换掉）
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  // 转义html
  _.escape = createEscaper(escapeMap);
  // 去转义
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
// 执行并返回结果
// object[property]是函数就以object为ctx执行，否则直接返回该值
// fallback是一个默认值，在属性值为undefined时上
  _.result = function(object, property, fallback) {
    // 取值（undefined/null转undefined）
    var value = object == null ? void 0 : object[property];
    // 如果值为undefined，填上默认值（没传的话还是undefined）
    if (value === void 0) {
      value = fallback;
    }
    // 是函数就执行（并以object为ctx），否则直接返回属性值
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  // 私有计数器
  var idCounter = 0;
// 生成客户端唯一id
//!!! 如果没有prefix的话，直接就是1, 2, 3...很容易冲突
// 多用作临时DOM id
  _.uniqueId = function(prefix) {
    // 先自增，从1开始
    var id = ++idCounter + '';
    // 传了前缀的话拼上，否则裸1, 2, 3...
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
// 到模板了，underscore一大亮点
// 模板语法，分割符定义
  _.templateSettings = {
    // 计算求值 <% ...%>
    evaluate    : /<%([\s\S]+?)%>/g,
    // 插值 <%- ...%>
    interpolate : /<%=([\s\S]+?)%>/g,
    // 转义插值 <%- ...%>
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  // 默认设置
// 重写_.templateSettings时，如果没有全部重写，说明不想要其它的，用这个排除掉
  // 捕获一个任意字符，要求后面跟着开始符
  // 肯定匹配失败，得到null
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  // 转义字典
  var escapes = {
    "'":      "'",
    '\\':     '\\',
// 下面4个都有换行的含义，JS字符串字面量不允许换行，需要转义
    '\r':     'r',  // 回车
    '\n':     'n',  // 换行
    '\u2028': 'u2028',  // 行分隔符
    '\u2029': 'u2029'   // 段落分隔符
  };

  // 用于转义的正则
  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;
  // 查字典
  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
// 模板
// 支持自定义分隔符，保留空白字符，自动转义引号
//! oldSettings现在没毛用了，是为了兼容之前的版本
// 返回一个函数，接收data，生成html，相当于：
// tpl => data => render(tpl, data)
  _.template = function(text, settings, oldSettings) {
    // 向后兼容
    if (!settings && oldSettings) settings = oldSettings;
    // 整合出新模板语法正则，先从settings上抄，没抄全就再从_.templateSettings上抄
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
// 把三种语法正则用|连接起来
    // 没有的话就填上不匹配的默认值noMatch
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    // 模板串位置指针
    var index = 0;
    // __p是最终输出的html字符串
    // __t是临时变量，用来做null/undefined判断，避免原样输出null、undefined
    var source = "__p+='";
// 模板串转函数
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
// 如果是noMatch，str.replace(regexp, func)，不会执行这个func
      // 拼上匹配之前的部分（非模板语法，当普通html处理，直接转义拼上）
      source += text.slice(index, offset).replace(escaper, escapeChar);
      // 位置指针右移，走过匹配部分的长度
      index = offset + match.length;

      // 处理捕获到的部分，3种模板语法
      if (escape) {
        // 转义，避免输出undefined，unll
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        // 插值，避免输出undefined，unll
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        // 计算，直接把待求值部分拼上去
// 计算作为独立语句存在，所以可以声明变量，想做什么都行，反正被函数作用域包着
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      //! 兼容adobe的vm，避免offset出错
      return match;
    });
    // 拼上结束单引号
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
// obj || {}避免报错，会出现undefined
//! 开了with作用域，使用时不需要通过obj.xx引用数据
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    // __j是数组join()的别名
// print()会把参数join起来拼在html结果串上
//! 为了方便在计算<% ...%>中输出内容，单参print()等价于<%= ...%>，多参的会被join(, '')连接起来
    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      // 模板函数
// 2个参数（变量名，默认'obj'，可以通过传入settings.variable来改；_），最后一个是函数体
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
    // 模板存在语法错误，抛出错误
      e.source = source;
      throw e;
    }

    // 执行模板函数
    var template = function(data) {
      // 传入data和_
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    // 模板函数需要的data形参
    var argument = settings.variable || 'obj';
    // 暴露出编译后的源码
//! 用来支持预编译，这样就可以在发布前把模板串换掉，省去运行时编译（正则处理）模板串的时耗
//! 同样，预编译也可以用在服务端，方便调试（准确的行号和调用栈）
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
// 链式调用
// 把obj包进_的实例，见开头的var _ = function(obj) {...}
  _.chain = function(obj) {
    // 确保instance是_的实例
    var instance = _(obj);
    // 链式调用标识
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
// 连接中间结果
// 用来支持链式调用
  var result = function(instance, obj) {
// 想要链式调用就接着包起来链式调用，否则直接返回obj
    // _实例有链式调用标识就执行chain()，否则返回obj
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
// 扩展_
// 把静态方法全粘到原型对象上
  _.mixin = function(obj) {
    // 遍历obj身上的所有方法名
    _.each(_.functions(obj), function(name) {
      // 当前方法
      var func = _[name] = obj[name];
      // 粘到_的原型对象上去
      _.prototype[name] = function() {
        // 准备参数，把被包裹的对象作为第一个参数
        var args = [this._wrapped];
        // 把调用时的参数列表接上去
        push.apply(args, arguments);
        // 用准备好的参数，以_为ctx执行当前方法
        // result()用来处理需不需要支持链式调用
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
//! 能支持OOP的原因
// 把自己的静态方法全粘到原型对象上
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
// 支持所有数组写入方法
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    // 从Arrap.prototype上拿到数组方法引用
    var method = ArrayProto[name];
    // 粘到_的原型对象上
    _.prototype[name] = function() {
      // 取出被包裹的对象
      var obj = this._wrapped;
      // 以被包裹的对象执行数组方法
      method.apply(obj, arguments);
// 特殊处理shift()和splice()这种会改变原数组内容的
// 如果内容改变之后，原数组length为0，就删掉首元
//? 为什么要删掉首元
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      // result()处理要不要支持链式调用
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
// 支持所有数组取值方法
  _.each(['concat', 'join', 'slice'], function(name) {
    // 拿到数组方法引用
    var method = ArrayProto[name];
    // 粘到_的原型对象上
    _.prototype[name] = function() {
      // 以为被包裹的对象为ctx，执行数组方法，对结果做支持链式调用检测处理
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
// 支持取出目前被包裹的对象
// “目前”因为某些方法可能会改变被包裹对象，比如push()、pop()等数组方法
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
// 支持算数运算和JSON.stringify
// 分别重写valueOf()和toJSON()，传递给被包裹的对象，不做额外处理
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

// 重写toString()，直接把被包裹对象转字符串
  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
// 兼容AMD模块
  if (typeof define === 'function' && define.amd) {
// 定义一个具名模块underscore，无依赖项，返回_
//! 非要具名是为了避免在本文件外调用define()报错
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));
