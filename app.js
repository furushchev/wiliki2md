var $ = require('cheerio');
var client = require('cheerio-httpcli');
var _ = require('lodash');
var md = require('to-markdown');
var fs = require('fs.extra');
var prompt = require('prompt');
var path = require('path');
var async = require('async');
var inspect = require('util').inspect;
var ecl = require('./ecl');
var jconv = require('jconv');

var convertToMarkdown = function(addr, cb){
  client.fetch(addr, {}, 'euc-jp', function(err, $){
    if(err)  return cb(null, err);
    var body =  _.map($('td[valign="top"]:not(.menu-strip)').children(),
                      function(e){ return $(e).html();}).join();
    var mdoption = {
      gfm: true,
      converters: [
        {
          filter: 'a',
          replacement: function(html, node){
            if (node.href.startsWith('wiliki.cgi?')){
              var href = ecl.UnescapeEUCJP(node.href.replace(/^wiliki.cgi\?/, "")).replace(/\//g,'-');
            } else {
              var href = node.href;
            }
            return '[' + html + '](' + href + ')';
          }
        },
        {
          filter: ['tr'],
          replacement: function(html, node){
            var prev_tr = $(node).prev();
            if (prev_tr) {
              return '\n' + html;
            } else {
              var boarder = '\n';
              for (var i = 0; i < $(node).children().length; ++i){
                boarder += '|---';
              }
              boarder += '|';
              return '\n' + html + boarder;
            }
          }
        }
      ]
    };
    var enc = $.documentInfo().encoding;
    var bodystr = body;
    var mdbody = md(bodystr, mdoption);
    header = '---\nformat: markdown\ntoc: no\n...\n\n';
    return cb(header + mdbody, null);
  });
};

var main = function(){
  // prompt.start();
  // prompt.get({
  //   properties: {
  //     username: { required: true },
  //     password: { hidden: true, required: true }
  //   }}, function(err, argv){
  //     if(err) return console.log(err);
  var argv = {
    username: "jskgl", password: "jskuma"
  };
      var base_url = 'http://www.jsk.t.u-tokyo.ac.jp/wiliki/';
      var out_dir = 'output';
      var max_conn = 10;
      var ext = '.page';

      // create output directory
      console.log('output dir: ' + out_dir);
      fs.rmrfSync(out_dir);
      fs.mkdir(out_dir);

      // client settings
      client.headers['Authorization'] = 'Basic ' +
        new Buffer(argv.username + ':' + argv.password).toString('base64');
      client.setBrowser('chrome');
      client.timeout = 1000000;

      // walk and convert all pages to markdown
      var index_url = base_url + 'wiliki.cgi?c=a';
      console.log('fetching index from ' + index_url);
      client.fetch(index_url, function(err, $){
        if(err)  return console.log(err);
        console.log('converting articles to markdown with ' + max_conn + ' connections');
        async.eachLimit($('td[valign="top"]:not(.menu-strip) ul li a')[:0], max_conn, function(a, cb){
          var href = a.attribs['href'];
          var page_name = href.replace(/^wiliki.cgi\?/, "");
          if (page_name.startsWith('http')) {
            console.log('url: ' + page_name + ' is not in wiliki.');
            console.log('skipping...');
            return cb();
          }
          var page_url = base_url + href;
          console.log('converting: ' + ecl.UnescapeEUCJP(page_url));
          convertToMarkdown(page_url, function(md, err){
            if (err) return cb(err);
            fs.writeFile(path.join(out_dir, ecl.UnescapeEUCJP(page_name).replace(/\//g,'-')) + ext, md,
                         function(err){
                           if (err) cb(err);
                           else cb();
                         });
          });
        }, function(err) {
          if(err) console.log(inspect(err));
          else console.log('done!');
        });
      });

      // create index
      convertToMarkdown(index_url, function(md, err){
        if (err) return console.log(err);
        fs.writeFile(path.join(out_dir, 'index') + ext, md,
                     function(err){
                       if (err) console.log(err);
                     });
      });
  //   });
};

main();
