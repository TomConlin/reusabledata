////
//// Temporarily create a static page listing concerns; still want the
//// one-page app.
////
//// Example usage:
////  node ./scripts/tmp_static_output_gen.js -i ./data-sources/compiled.json -t ./scripts/tmp_static_output_gen.tmpl -o ./docs/index.html
////

var us = require('underscore');
var fs = require("fs");
var yaml = require('yamljs');
var mustache = require('mustache');
var pug = require('pug');

///
/// Helpers.
///

// Aliases.
var each = us.each;

function _ll(arg1){
    console.log(arg1); 
}

var debug = false;
function _debug(arg1){
    if( debug ){
	console.log(arg1);
    }
}

// Two or one  args.
function _die(m1, m2){
    if( typeof(m2) !== 'undefined' ){
	console.error('ERROR:', m1, m2);
    }else{
	console.error('ERROR:', m1);
    }
    process.exit(-1);
}

///
/// Opts.
///

var argv = require('minimist')(process.argv.slice(2));

// Add extra "debugging" messages.
debug = argv['d'] || argv['debug'];
if( debug ){
    _debug('Debugging is on.');
}else{
}

//
var in_data = argv['i'] || argv['in'];
if( ! in_data ){
    _die('Option (i|in) is required.');
}else{
    _debug('Will use input JSON file: ' + in_data);
}

//
var in_tmpl = argv['t'] || argv['template'];
if( ! in_tmpl ){
    _die('Option (t|template) is required.');
}else{
    _debug('Will use input JSON file: ' + in_tmpl);
}

//
var out_file = argv['o'] || argv['out'];
if( ! out_file ){
    _die('Option (o|out) is required.');
}else{
    _debug('Will use output file: ' + out_file);
}

///
/// Main.
///

var data_sources = JSON.parse(fs.readFileSync(in_data, 'utf-8'));
_debug('data', data_sources);

// Goose the data so we have a single html-displayable string for the
// license commentary.
console.log('===');
var summary_count = {};
var summary_total_count = 0;
var summary_known_count = 0;
var summary_unknown_count = 0;
//var summary_group_count = {};
var summary_violation_group = {
    "A": {},
    "B": {},
    "C": {},
    "D": {},
    "E": {}
};
var summary_violation = {
    "A.1.1": [],
    "A.1.2": [],
    "A.2": [], 
    "B.1": [],
    "B.2.1": [],
    "B.2.2": [],
    "C.1": [],
    "C.2": [],
    "D.1.1": [],
    "D.1.2": [],
    "E.1.1": [],
    "E.1.2": []
};
us.each(data_sources, function(source){
    var sid = source['id'];

    if( source['status'] === 'nonpublic' ){
	console.log('Skipping non-public: ' + sid);
    }else if( source['status'] === 'incomplete' ){
	console.log('Skipping incomplete: ' + sid);
    }else{

	var cache = [];
	us.each(source['license-commentary'], function(comment){
	    cache.push(comment);
	});
	source['license-commentary-embeddable'] = cache.join('<hr />');

	var tags_cache = [];
	if( source['data-field'] ){
	    tags_cache.push(source['data-field']);
	}
	if( source['data-type'] ){
	    tags_cache.push(source['data-type']);
	}
	us.each(source['data-categories'], function(comment){
	    tags_cache.push(comment);
	});
	source['data-tags'] = tags_cache.join(', ');

	///
	/// Logic for automatic scoring and summary stats.
	///

	// Unroll the actual criteria violations into a lookup.
	var s = {};
	if( typeof(summary_count[sid]) === 'undefined' ){
	    summary_count[sid] = [];
	}
	if( source['license-issues'] ){
	    us.each(source['license-issues'], function(li){

		// Mark as true.
		s[li['criteria']] = true;

		// Accumulate stat.
		summary_violation[li['criteria']].push(sid);
		summary_violation_group[li['criteria'].charAt(0)][sid] = true;
		summary_count[sid].push(li['criteria']);
	    });
	}

	// Start with a possible 5 points.
	var grade = 5.0;

	// C and only C.
	var evaluate_C = function(){
	    if( s['C.1'] ){
		grade -= 0.5;
	    }
	    if( s['C.2'] ){
		grade -= 0.5;
	    }
	};

	// Deal with license location short-circuits first.
	summary_total_count++;
	if( s['A.1.1'] && s['A.1.2'] ){
	    _die('A.1.* violations are mutually exclusive: ' + sid);
	}else if( s['A.1.1'] ){
	    grade -= 4.0;
	    evaluate_C();
	    summary_unknown_count++;
	}else if( s['A.1.2'] ){
	    grade -= 4.0;
	    evaluate_C();
	    summary_unknown_count++;
	}else{
	    summary_known_count++;

	    if( s['A.2'] ){
		grade -= 0.5;
	    }
	    if( s['B.1'] ){
		grade -= 0.5;
	    }
	    if( s['B.2.1'] || s['B.2.2'] ){
		grade -= 0.5;
	    }
	    evaluate_C();
	    if( s['D.1.1'] ){
		grade -= 0.5;
	    }
	    if( s['D.1.2'] ){
		grade -= 1.0;
	    }
	    if( s['E.1.1'] ){
		grade -= 0.5;
	    }
	    if( s['E.1.2'] ){
		grade -= 1.0;
	    }
	}

	// Do not override "given" grade at this point.
	source['grade-automatic'] = grade;
	
	// It should not be possible for any type of restrictive
	// license to get above 3.0.
	var restrictive_check = '';
	if( source['license-type'] === 'restrictive' ||
	    source['license-type'] === 'all rights reserved'){
	    if( grade > 3.0 ){
		restrictive_check = '?';
	    }
	}

	console.log('Curated/generated grade ('+
		    source['id'] +'): ' +
		    grade + ' ' +
		    restrictive_check);
    }
});

// Summary stats.
console.log('===');
//console.log(summary_count);
us.each(us.keys(summary_count).sort(), function(k){
    console.log('Violation count (' +
		k + '): ' +
		summary_count[k].length + ' [' +
		summary_count[k].join(', ') + ']');
});
console.log('===');
//console.log(summary_violation_group);
us.each(us.keys(summary_violation_group).sort(), function(grp){

    var grp_sum = summary_violation_group[grp];
    var grp_cnt = us.keys(grp_sum).length;
	
     var print_str = grp + ': ' + grp_cnt;

    // A is already violated and C is always evaluated.
    if( grp === 'A' || grp === 'C' ){ 
	print_str += ' / ' + grp_cnt;
    }else{
	print_str += ' / ' + (grp_cnt + summary_unknown_count);
    }

    console.log('Best/worst violation by a resource in group (' + grp + '): ' +
		print_str);
});

console.log('===');
console.log('Total resources: ' + summary_total_count);
console.log('Clear resources (no A.1.*): ' + summary_known_count);
console.log('Unclear resources (yes A.1.*): ' + summary_unknown_count);
	
// Pug/Jade for table.
var html_table_str = pug.renderFile('./scripts/static-table.pug',
				    {"data_sources": data_sources});
//console.log(html_table_str);
console.log('===');

// Mustache for final.
var template = fs.readFileSync(in_tmpl, 'utf-8');
_debug('template', template);

var outstr = mustache.render(template, {
    "jsondata": JSON.stringify(data_sources),
    "htmltablestr": html_table_str,
    "tabledata": data_sources
});

fs.writeFileSync(out_file, outstr);


