#!/usr/bin/python -O
# -*- coding: iso-8859-15 -*-

'''
GNU GENERAL PUBLIC LICENSE

This is an example of a signaling server for a WebRTC App with two peer.

Copyright (C) 2014 Cristóbal Medina López.
		   Vicente Gonzalez Ruiz

http://www.p2psp.org

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
'''
import socket, threading, time, base64, hashlib, struct, binascii
import simplejson as json
from SimpleWebSocketServer import WebSocket, SimpleWebSocketServer

class Signaling(WebSocket):

	def handleMessage(self):
		global peeridlist

		datos=str(self.data)
		try:
		    decoded = json.loads(datos)
		except (ValueError, KeyError, TypeError):
		    print "JSON format error"
		
		if 'sdp' or 'candidate' in decoded:
			try:
				peeridlist[int(decoded['idreceiver'].replace('"',''))].sendMessage(str(self.data))		
			except Exception as n:
				print "Unknow error: "+n		
				 


	def handleConnected(self):
		global nextid
		global peeridlist
		print self.address, 'connected'
		
		try:
			self.sendMessage(str('{"numpeer":"'+str(nextid)+'"}'))
			peeridlist[nextid]=self
			nextid=nextid+1
		except Exception as n:
			print "Unknow error: "+n
		

	def handleClose(self):
		global peeridlist
		peeridlist.remove(peeridlist.index(self));     

if __name__ == '__main__':
	nextid = 0
	peeridlist={}
	server = SimpleWebSocketServer('', 9876, Signaling)
	server.serveforever()
	
