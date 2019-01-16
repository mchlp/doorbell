#include <sys/ioctl.h>
#include <fcntl.h>
#include <linux/cdrom.h>
#include <stdio.h>
#include <unistd.h>

int main(int argc,char **argv) {
	int cdrom;

	if ((cdrom = open("/dev/sr0",O_RDONLY | O_NONBLOCK)) < 0) {
		fprintf(stderr, "Unable to open device %s",argv[1]);
		return 1;
	}

	if (ioctl(cdrom,CDROM_DRIVE_STATUS) == CDS_TRAY_OPEN) {
		printf("open");
	} else {
		printf("close");
	}

	close(cdrom);
}
