"use strict";

var fs = require('fs-promise');
var promise = require('promise');
var t = require("transducers-js");

var filter    = t.filter,
    comp      = t.comp,
    into      = t.into,
    transduce = t.transduce,
    mapcat    = t.mapcat;

var parse_file = function (content) {
    return JSON.parse(content);
};

var concat = function (a, b) {
    return a.concat(b);
};

var in_year = function (year) {
    return function (scrobble) {
        var start_year = new Date(year + '-01-01T00:00:00'),
            end_year = new Date(year + '-12-31T23:59:59'),
            scrobble_date = new Date(scrobble.timestamp.iso);
        return (scrobble_date - start_year) > 0 &&
            (scrobble_date - end_year) < 0;
    };
};

var top_n = function (counts, n, counter) {
    var sortable = Object.keys(counts).reduce(counter, []);
    return sortable.sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
};

var select_first  = function (counts) {
    return top_n(counts, 2, function (result, item) {
        result.push([item, counts[item].count]);
        return result;
    })[0];
};

var most_played_one_per_artist = function (stats, n) {
    return top_n(stats, n, function (result, artist) {
        var track = select_first(stats[artist].tracks);
        result.push([{'artist': artist, 'track': track[0]}, track[1]]);
        return result;
    });
};

var counter = function (result, scrobble) {
    var artist_name = scrobble.track.artist.name,
        track_name = scrobble.track.name;
    if (artist_name in result) {
        result[artist_name].count += 1;
    } else {
        result[artist_name] = {};
        result[artist_name].tracks = {};
        result[artist_name].count = 1;
    }

    if (track_name in result[artist_name].tracks) {
        result[artist_name].tracks[track_name].count += 1;
    } else {
        result[artist_name].tracks[track_name] = {};
        result[artist_name].tracks[track_name].count = 1;
    }
    return result;
};

var main = function (argv) {
    var year = argv[1] === undefined ? '2014' : argv[1],
        scrobble_dir = argv[2] === undefined ? "./scrobbles/" : argv[2];

    var p = fs.readdir(scrobble_dir);

    p.then(function (files) {
        var promises = [],
            scrobble_file = "",
            i = 0;

        for (i = 0; i < files.length; i += 1) {
            scrobble_file = scrobble_dir + files[i];
            promises.push(fs.readFile(scrobble_file));
        }

        promise.all(promises).then(function (results) {
            var xf = comp(mapcat(parse_file),
                          filter(in_year(year)));

            var stats = transduce(xf, counter, {}, results);

            var twenty_most_played = most_played_one_per_artist(stats, 20);
            console.log("PLAYS\tTRACK")
            twenty_most_played.forEach(function (play) {
                var entry = play[0];
                var plays = play[1];
                console.log(plays + "\t" + entry.artist + " - " + entry.track);
            });
        }, function (errors) {
            errors.map(function (error) {
                console.log(error);
            });
        });

    });
};

main(process.argv.slice(1));
