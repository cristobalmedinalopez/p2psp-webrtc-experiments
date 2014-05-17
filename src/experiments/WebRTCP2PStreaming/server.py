#!/usr/bin/python -O
# -*- coding: iso-8859-15 -*-

'''
GNU GENERAL PUBLIC LICENSE

This is an example of a signaling server+P2P video streaming over WebRTC.

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

def nextChunk(client):
	global numblock
	global file
	try:
		
		chunk = file.read(1024)
		numblock=numblock+1
		message=struct.pack("H1024s", numblock, chunk)
		client.sendMessage(buffer(message))
		print 'numero: '+str(numblock)
		
	except Exception as n:
		print "Unknow error in nextChunk: "+n
		chunk = None
		file.close()

	return chunk

def feedCluster(client):
	global numblock
	global file

	chunk=nextChunk(client)

	#print "first block: "+str(numblock)
	while chunk is not None:
		#message=struct.pack("H1024s", numblock, chunk)
		#if (numblock<100):
			#print numblock
		#client.sendMessage(buffer(message))

		chunk=nextChunk(client)

		#If you send too fast the client crashes
		time.sleep(0.025)

	file.close()

class Signaling(WebSocket):

	def handleMessage(self):
		global peeridlist

		datos=str(self.data)
		try:
		    decoded = json.loads(datos)
		except (ValueError, KeyError, TypeError):
		    print "JSON format error"
		if 'fire' in decoded:
			threading.Thread(target=feedCluster, args=(self,)).start()
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
			self.sendMessage(str('{"peerlist":"'+str(peerlist)+'"}'))
			message=struct.pack("H1024s", 0, header)
			self.sendMessage(buffer(message))
			peerlist.append(nextid)
			peeridlist[nextid]=self
			nextid=nextid+1
		except Exception as n:
			print "Unknow error: "+n
		

	def handleClose(self):
		global file
		global peeridlist
		peeridlist.remove(peeridlist.index(self));  
	
		if (len(self.server.connections)==0):
			file.close()		
			print 'the file is closed'   

if __name__ == '__main__':
	nextid = 0
	peeridlist={}
	peerlist=[]
	numblock=0
	
	file=open("test.webm","rb")
	print 'file opened'
	try:
		header = file.read(1024)
		#print 'header is: '+str(header)
	except Exception as n:
		print 'I cannot get the header: '+n

	server = SimpleWebSocketServer('', 9876, Signaling)
	server.serveforever()
