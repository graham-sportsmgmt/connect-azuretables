'use strict';

var mockery = require('mockery');
var moduleUnderTest = '../lib/connect-azuretables';
mockery.registerAllowable(moduleUnderTest);
mockery.registerAllowable('util');
mockery.registerAllowable('express-session');
var session = require('express-session');

//azure-storage mock
var mockTableService = {};
mockTableService.createTableService = function() {};
mockTableService.withFilter = function() { return this; };
mockTableService.createTableIfNotExists = function() {};

//entityGeneratorMock
var mockEntGen = {};
mockEntGen.String = function(value) { return value; }

//azure-storage mock
var mockAzureStorage = {};
mockAzureStorage.createTableService = function() { return mockTableService; };
mockAzureStorage.LinearRetryPolicyFilter = function() {};
mockAzureStorage.TableUtilities = { entityGenerator: mockEntGen };

mockery.registerMock('azure-storage', mockAzureStorage);

var AzureTablesStore;

beforeEach(function() {
    
    mockery.enable({useCleanCache: true});
    AzureTablesStore = require(moduleUnderTest)(session);
    
});

afterEach(function() {
    
    mockery.disable();
    
});

describe('initialisation tests: ', function() {
    
    it('should throw when calling the constructor as a function', function() {
        
        expect(AzureTablesStore).toThrow();
        
    });
    
    it('should inherit from the session Store', function() {
        
        var options = {storageAccount: 'account', accessKey: 'key'};
        expect(new AzureTablesStore(options) instanceof session.Store).toBe(true); 
          
    });
    
    it('should create table service using the supplied connection values', function() {
        
        var options = {storageAccount: 'account', accessKey: 'key'};
        spyOn(mockAzureStorage, 'createTableService').and.callThrough();
        new AzureTablesStore(options); 
        expect(mockAzureStorage.createTableService).toHaveBeenCalled();
        expect(mockAzureStorage.createTableService.calls.argsFor(0)).toEqual([options.storageAccount,options.accessKey]);
    });
    
    it('should create table service using the connection string in the environment variables', function() {

        var options = {storageAccount: 'account', accessKey: 'key'};        
        process.env.AZURE_STORAGE_CONNECTION_STRING = 'connection string';
        spyOn(mockAzureStorage, 'createTableService').and.callThrough();
        new AzureTablesStore(options); 
        expect(mockAzureStorage.createTableService).toHaveBeenCalled();
        expect(mockAzureStorage.createTableService.calls.argsFor(0)).toEqual([]);
    });
    
    it('should create table service using the account/key in the environment variables', function() {
       
        process.env.AZURE_STORAGE_ACCOUNT = 'account';
        process.env.AZURE_STORAGE_ACCESS_KEY = 'key';
        spyOn(mockAzureStorage, 'createTableService').and.callThrough();
        new AzureTablesStore(); 
        expect(mockAzureStorage.createTableService).toHaveBeenCalled();
        expect(mockAzureStorage.createTableService.calls.argsFor(0)).toEqual([]);
    });
    
    it('should create the default table', function(){
        
        var options = {storageAccount: 'account', accessKey: 'key'};
        spyOn(mockTableService, 'createTableIfNotExists').and.callThrough();
        new AzureTablesStore(options);
        expect(mockTableService.createTableIfNotExists).toHaveBeenCalled();  
        expect(mockTableService.createTableIfNotExists.calls.argsFor(0)[0]).toEqual('ConnectAzureTablesSessions');     
        
    });
    
    it('should override the default table name', function(){
        
        var options = {storageAccount: 'account', accessKey: 'key', table: 'table'};
        spyOn(mockTableService, 'createTableIfNotExists').and.callThrough();
        new AzureTablesStore(options);
        expect(mockTableService.createTableIfNotExists).toHaveBeenCalled();  
        expect(mockTableService.createTableIfNotExists.calls.argsFor(0)[0]).toEqual('table');     
        
    });
    
    it('should error on table creation', function() {
        
        var options = {storageAccount: 'account', accessKey: 'key', table: 'table'};
        var error = 'table error';
        
        mockTableService.createTableIfNotExists = function(table, cb) { 
            cb(error);   
        };
        
        spyOn(mockTableService, 'createTableIfNotExists').and.callThrough();  
        expect(function() { new AzureTablesStore(options); } ).toThrow();
        expect(mockTableService.createTableIfNotExists).toHaveBeenCalled();  
        
    });
    
    it('should not error on table creation', function() {
        
        var options = {storageAccount: 'account', accessKey: 'key', table: 'table'};
        
        mockTableService.createTableIfNotExists = function(table, cb) { 
            cb(null, true);   
        };
        
        spyOn(mockTableService, 'createTableIfNotExists').and.callThrough();  
        expect(function() { new AzureTablesStore(options); } ).not.toThrow();
        expect(mockTableService.createTableIfNotExists).toHaveBeenCalled();  
        
    });
    
});

describe('destroy tests: ', function() {
    
    var azureTablesStore;
    var sid = 'sidfordeletion';
    var handler = {};
    handler.callBack = function() {};
    
    beforeEach(function() {
        
        var options = {storageAccount: 'account', accessKey: 'key', table: 'table'};
        azureTablesStore = new AzureTablesStore(options);
        spyOn(handler,'callBack');   
        
    });
    
    it('should destroy the specified session', function() {
        
        mockTableService.deleteEntity = function() {};
        spyOn(mockTableService,'deleteEntity').and.callThrough();
        azureTablesStore.destroy(sid);
        expect(mockTableService.deleteEntity).toHaveBeenCalled();
        expect(mockTableService.deleteEntity.calls.argsFor(0)[1]).toEqual({PartitionKey: sid, RowKey: sid});
        
    });
    
    it('should destroy the specified session and call back', function() {
        
        var result = 'delete result';
        
        mockTableService.deleteEntity = function(table, session, cb) {
            cb(null, result); 
        };
        
        spyOn(mockTableService,'deleteEntity').and.callThrough();
        azureTablesStore.destroy(sid, handler.callBack);
        expect(mockTableService.deleteEntity).toHaveBeenCalled();
        expect(mockTableService.deleteEntity.calls.argsFor(0)[1]).toEqual({PartitionKey: sid, RowKey: sid});
        expect(handler.callBack).toHaveBeenCalled();
        expect(handler.callBack.calls.argsFor(0)).toEqual([null, result]);
        
    });

    it('should error when destroying the session', function() {
        
        var error = 'delete error';
        
        mockTableService.deleteEntity = function(table, session, cb) {
            cb(error); 
        };
        
        spyOn(mockTableService,'deleteEntity').and.callThrough();
        azureTablesStore.destroy(sid, handler.callBack);
        expect(mockTableService.deleteEntity).toHaveBeenCalled();
        expect(mockTableService.deleteEntity.calls.argsFor(0)[1]).toEqual({PartitionKey: sid, RowKey: sid});
        expect(handler.callBack).toHaveBeenCalled();
        expect(handler.callBack.calls.argsFor(0)).toEqual([error]);
        
    });
    
});
    
describe('get tests: ', function() {
    
    var azureTablesStore;
    var sid = 'sidforgetting';
    var handler = {};
    handler.callBack = function() {};
    
    beforeEach(function() {
        
        var options = {storageAccount: 'account', accessKey: 'key', table: 'table'};
        azureTablesStore = new AzureTablesStore(options);
        spyOn(handler,'callBack');   
        
    });
    
    it('should get the specified session', function() {

        mockTableService.retrieveEntity = function() {};
        spyOn(mockTableService,'retrieveEntity').and.callThrough();
        azureTablesStore.get(sid);
        expect(mockTableService.retrieveEntity).toHaveBeenCalled();
        expect(mockTableService.retrieveEntity.calls.argsFor(0)[1]).toEqual(sid);
        expect(mockTableService.retrieveEntity.calls.argsFor(0)[2]).toEqual(sid);        
    });
    
    it('should get the specified session and call back', function() {
        
        var session = {value: 'get result'};
        var entity = {data: {_: JSON.stringify(session)}};
        
        mockTableService.retrieveEntity = function(table, partitionKey, rowKey, cb) {
            cb(null, entity); 
        };
        
        spyOn(mockTableService,'retrieveEntity').and.callThrough();
        azureTablesStore.get(sid, handler.callBack);
        expect(mockTableService.retrieveEntity).toHaveBeenCalled();
        expect(mockTableService.retrieveEntity.calls.argsFor(0)[1]).toEqual(sid);
        expect(mockTableService.retrieveEntity.calls.argsFor(0)[2]).toEqual(sid);  
        expect(handler.callBack).toHaveBeenCalled();
        expect(handler.callBack.calls.argsFor(0)).toEqual([null, session]);
        
    });

    it('should error when getting the session', function() {
        
        var error = 'get error';
        
        mockTableService.retrieveEntity = function(table, partitionKey, rowKey, cb) {
            cb(error); 
        };
        
        spyOn(mockTableService,'retrieveEntity').and.callThrough();
        azureTablesStore.get(sid, handler.callBack);
        expect(mockTableService.retrieveEntity).toHaveBeenCalled();
        expect(mockTableService.retrieveEntity.calls.argsFor(0)[1]).toEqual(sid);
        expect(mockTableService.retrieveEntity.calls.argsFor(0)[2]).toEqual(sid); 
        expect(handler.callBack).toHaveBeenCalled();
        expect(handler.callBack.calls.argsFor(0)).toEqual([error]);
        
    });
     
});

describe('set tests: ', function() {
    
    var azureTablesStore;
    var sid = 'sidforsetting';
    var session = {value: 'session value'};
    var entity = { PartitionKey: sid, RowKey: sid, data: JSON.stringify(session) };
    var handler = {};
    handler.callBack = function() {};
    
    beforeEach(function() {
        
        var options = {storageAccount: 'account', accessKey: 'key', table: 'table'};
        azureTablesStore = new AzureTablesStore(options);
        spyOn(handler,'callBack');   
        
    });
    
    it('should set the specified session', function() {

        mockTableService.insertOrReplaceEntity = function() {};
        spyOn(mockTableService,'insertOrReplaceEntity').and.callThrough();
        azureTablesStore.set(sid, session);
        expect(mockTableService.insertOrReplaceEntity).toHaveBeenCalled();
        expect(mockTableService.insertOrReplaceEntity.calls.argsFor(0)[1]).toEqual(entity);
    });
    
    it('should get the specified session and call back', function() {
        
        var result = 'set result';
        
        mockTableService.insertOrReplaceEntity = function(table, session, cb) {
            cb(null, result); 
        };
        
        spyOn(mockTableService,'insertOrReplaceEntity').and.callThrough();
        azureTablesStore.set(sid, session, handler.callBack);
        expect(mockTableService.insertOrReplaceEntity).toHaveBeenCalled();
        expect(mockTableService.insertOrReplaceEntity.calls.argsFor(0)[1]).toEqual(entity);
        expect(handler.callBack).toHaveBeenCalled();
        expect(handler.callBack.calls.argsFor(0)).toEqual([null, result]);
        
    });

    it('should error when setting the session', function() {
        
        var error = 'set error';
        
        mockTableService.insertOrReplaceEntity = function(table, session, cb) {
            cb(error); 
        };
        
        spyOn(mockTableService,'insertOrReplaceEntity').and.callThrough();
        azureTablesStore.set(sid, session, handler.callBack);
        expect(mockTableService.insertOrReplaceEntity).toHaveBeenCalled();
        expect(mockTableService.insertOrReplaceEntity.calls.argsFor(0)[1]).toEqual(entity);
        expect(handler.callBack).toHaveBeenCalled();
        expect(handler.callBack.calls.argsFor(0)).toEqual([error]);
        
    });
     
});