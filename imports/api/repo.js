import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo'

export const Githubitems = new Mongo.Collection('githubitems');
export const Githubcount = new Mongo.Collection('githubcount');


if (Meteor.isServer) {
  // This code only runs on the server
  Meteor.publish('githubitems', function githubitemsPublication() {
    return Githubitems.find();
  });
  Meteor.publish('githubcount', function githubcountPublication() {
    return Githubcount.find();
  });
}